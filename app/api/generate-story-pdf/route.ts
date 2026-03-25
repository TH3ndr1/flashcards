import { NextRequest, NextResponse } from 'next/server';
import { createActionClient } from '@/lib/supabase/server';
import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont } from 'pdf-lib';
import { appLogger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as fontkit from 'fontkit';
import type { Story, StoryParagraph } from '@/types/story';

// ── Font configuration (mirrors /api/generate-deck-pdf) ──────────────────────

const FONT_FILES_BASE_PATH = 'public/fonts/';

interface FontStylePath { type: 'custom'; fileName: string; }
interface FontStyleStandard { type: 'standard'; standardFont: StandardFonts; }
type FontStyle = FontStylePath | FontStyleStandard;

interface FontChoiceConfig { regular: FontStyle; bold: FontStyle; }

const FONT_CONFIG_MAP: Record<string, FontChoiceConfig> = {
  default: {
    regular: { type: 'standard', standardFont: StandardFonts.Helvetica },
    bold: { type: 'standard', standardFont: StandardFonts.HelveticaBold },
  },
  atkinson: {
    regular: { type: 'custom', fileName: 'AtkinsonHyperlegibleNext-Regular.otf' },
    bold: { type: 'custom', fileName: 'AtkinsonHyperlegibleNext-Bold.otf' },
  },
  opendyslexic: {
    regular: { type: 'custom', fileName: 'OpenDyslexic-Regular.otf' },
    bold: { type: 'custom', fileName: 'OpenDyslexic-Bold.otf' },
  },
};

async function loadFont(pdfDoc: PDFDocument, style: FontStyle): Promise<PDFFont> {
  if (style.type === 'custom') {
    const resolvedPath = path.join(process.cwd(), FONT_FILES_BASE_PATH, style.fileName);
    try {
      const fontBytes = fs.readFileSync(resolvedPath);
      return await pdfDoc.embedFont(fontBytes);
    } catch {
      return await pdfDoc.embedFont(
        style.fileName.toLowerCase().includes('bold') ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
      );
    }
  }
  return await pdfDoc.embedFont(style.standardFont);
}

// ── Text helpers ──────────────────────────────────────────────────────────────

/** Strip markdown bold/italic markers → plain text for PDF body */
function stripMarkdownForPdf(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
}

/** Detect [TOPIC: ...] prefix and return { title, rest } or null */
function parseTopicPrefix(text: string): { title: string; rest: string } | null {
  const match = text.trim().match(/^\[TOPIC:\s*(.+?)\]\s*([\s\S]*)/i);
  if (!match) return null;
  return { title: match[1].trim(), rest: match[2].trim() };
}

interface DialogueLine { speaker: 'T' | 'S' | 'topic'; text: string; }

function parseDialogueParagraph(text: string): DialogueLine[] | null {
  const hasMarkers = text.includes('[T]:') || text.includes('[S]:') ||
    /^\s*(?:\*\*)?(?:Teacher|Student)(?:\*\*)?:/mi.test(text);
  if (!hasMarkers) return null;

  const lines: DialogueLine[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const topicMatch = line.match(/^\[TOPIC:\s*(.+?)\]$/i);
    const tMatch = line.match(/^\[T\]:\s*(.+)$/);
    const sMatch = line.match(/^\[S\]:\s*(.+)$/);
    const legacyT = line.match(/^(?:\*\*)?Teacher(?:\*\*)?:\s*(.+)$/i);
    const legacyS = line.match(/^(?:\*\*)?Student(?:\*\*)?:\s*(.+)$/i);
    if (topicMatch) lines.push({ speaker: 'topic', text: topicMatch[1] });
    else if (tMatch) lines.push({ speaker: 'T', text: stripMarkdownForPdf(tMatch[1]) });
    else if (sMatch) lines.push({ speaker: 'S', text: stripMarkdownForPdf(sMatch[1]) });
    else if (legacyT) lines.push({ speaker: 'T', text: stripMarkdownForPdf(legacyT[1]) });
    else if (legacyS) lines.push({ speaker: 'S', text: stripMarkdownForPdf(legacyS[1]) });
  }
  return lines.length > 0 ? lines : null;
}

// ── Word-wrapping text draw (same pattern as deck PDF) ────────────────────────

async function drawTextWrapped(
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  page: ReturnType<PDFDocument['addPage']>,
  font: PDFFont,
  fontSize: number,
  color: ReturnType<typeof rgb>
): Promise<number> {
  const words = text.split(' ');
  let currentLine = '';
  let currentY = y;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
        currentY -= lineHeight;
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
    currentY -= lineHeight;
  }
  return currentY;
}

// ── Format labels ─────────────────────────────────────────────────────────────

function formatLabel(format: string): string {
  const labels: Record<string, string> = {
    narrative: 'Story',
    summary: 'Overview',
    dialogue: 'Dialogue',
    analogy: 'Analogies',
  };
  return labels[format] ?? format;
}

function readingTimeLabel(t: string | number): string {
  return t === 'minimal' ? 'Minimal' : `${t} min`;
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { deckId, cardFont, pdfCardContentFontSize } = body as {
      deckId: string;
      cardFont: string;
      pdfCardContentFontSize: number;
    };

    if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 });
    const fontSize = typeof pdfCardContentFontSize === 'number' && pdfCardContentFontSize >= 6 && pdfCardContentFontSize <= 24
      ? pdfCardContentFontSize : 11;

    // Fetch deck name + latest story
    const [deckResult, storyResult] = await Promise.all([
      supabase.from('decks').select('name').eq('id', deckId).eq('user_id', user.id).single(),
      supabase
        .from('stories')
        .select('*')
        .eq('deck_id', deckId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (deckResult.error || !deckResult.data) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }
    if (storyResult.error || !storyResult.data) {
      return NextResponse.json({ error: 'No story found for this deck' }, { status: 404 });
    }

    const deckName: string = deckResult.data.name ?? 'Untitled';
    const story = storyResult.data as unknown as Story;

    // ── Build PDF ─────────────────────────────────────────────────────────────

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontKey = FONT_CONFIG_MAP[cardFont] ? cardFont : 'default';
    const fontConfig = FONT_CONFIG_MAP[fontKey];

    const bodyFont = await loadFont(pdfDoc, fontConfig.regular);
    const boldFont = await loadFont(pdfDoc, fontConfig.bold);
    const stdFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const stdBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    const lineHeight = fontSize * 1.35;
    const topicLineHeight = (fontSize + 1) * 1.35;
    const smallFontSize = 9;
    const smallLineHeight = smallFontSize * 1.35;
    const paraSpacing = lineHeight * 0.6;
    const black = rgb(0, 0, 0);
    const gray = rgb(0.45, 0.45, 0.45);
    const lightGray = rgb(0.65, 0.65, 0.65);
    const primaryColor = rgb(0.18, 0.38, 0.78); // approximates default primary

    let page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const contentWidth = width - 2 * margin;
    let y = height - margin;

    // Helper: new page if needed
    const ensureSpace = (needed: number) => {
      if (y - needed < margin + smallLineHeight * 2) {
        page = pdfDoc.addPage(PageSizes.A4);
        y = height - margin;
      }
    };

    // ── Title ─────────────────────────────────────────────────────────────────
    const titleFontSize = 16;
    const titleLineHeight = titleFontSize * 1.3;
    y = await drawTextWrapped(deckName, margin, y, contentWidth, titleLineHeight, page, stdBoldFont, titleFontSize, black);
    y -= titleLineHeight * 0.2;

    // ── Metadata subtitle ────────────────────────────────────────────────────
    const meta = `${formatLabel(story.story_format ?? 'narrative')}  ·  ${readingTimeLabel(story.reading_time_min)} read  ·  age ${story.age_at_generation}  ·  ${story.paragraphs.length} paragraphs`;
    y = await drawTextWrapped(meta, margin, y, contentWidth, smallLineHeight, page, stdFont, smallFontSize, lightGray);
    y -= smallLineHeight * 0.5;

    // Divider
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lightGray });
    y -= lineHeight;

    // ── Story body ────────────────────────────────────────────────────────────
    const isDialogue = story.story_format === 'dialogue';

    for (const para of story.paragraphs) {
      // ── [TOPIC: ...] handling ──
      const topicParsed = parseTopicPrefix(para.primary);
      const primaryContent = topicParsed ? topicParsed.rest : para.primary;

      if (topicParsed) {
        ensureSpace(topicLineHeight * 2);
        y -= lineHeight * 0.4; // space before heading
        y = await drawTextWrapped(
          topicParsed.title.toUpperCase(),
          margin,
          y,
          contentWidth,
          topicLineHeight,
          page,
          boldFont,
          fontSize + 1,
          primaryColor
        );
        y -= topicLineHeight * 0.1;
        // Thin rule under heading
        page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth * 0.3, y }, thickness: 0.5, color: rgb(0.7, 0.8, 1) });
        y -= lineHeight * 0.5;
      }

      if (!primaryContent) continue; // heading-only paragraph

      // ── Dialogue ──
      if (isDialogue) {
        const lines = parseDialogueParagraph(primaryContent);
        if (lines) {
          for (const line of lines) {
            if (line.speaker === 'topic') continue; // already handled above
            const prefix = line.speaker === 'T' ? 'T: ' : 'S: ';
            const textToDraw = prefix + line.text;
            const prefixWidth = boldFont.widthOfTextAtSize(prefix, fontSize);
            const textColor = line.speaker === 'T' ? primaryColor : gray;

            ensureSpace(lineHeight * 2);
            // Draw prefix in bold
            page.drawText(prefix, { x: margin, y, font: boldFont, size: fontSize, color: textColor });
            // Draw rest with word-wrap, indented
            y = await drawTextWrapped(
              line.text,
              margin + prefixWidth,
              y,
              contentWidth - prefixWidth,
              lineHeight,
              page,
              bodyFont,
              fontSize,
              black
            );
            y -= paraSpacing * 0.5;
          }
        } else {
          ensureSpace(lineHeight * 2);
          const plain = stripMarkdownForPdf(primaryContent);
          y = await drawTextWrapped(plain, margin, y, contentWidth, lineHeight, page, bodyFont, fontSize, black);
        }
      } else {
        // ── Regular paragraph ──
        const plain = stripMarkdownForPdf(primaryContent);
        ensureSpace(lineHeight * 2);
        y = await drawTextWrapped(plain, margin, y, contentWidth, lineHeight, page, bodyFont, fontSize, black);
      }

      // ── Secondary / translation content ──
      if (para.secondary) {
        const secTopicParsed = parseTopicPrefix(para.secondary);
        const secContent = secTopicParsed ? secTopicParsed.rest : para.secondary;
        if (secContent) {
          const secFontSize = fontSize - 1;
          const secLineHeight = secFontSize * 1.35;
          ensureSpace(secLineHeight * 2);
          y -= secLineHeight * 0.2;
          const secPlain = stripMarkdownForPdf(secContent);
          y = await drawTextWrapped(secPlain, margin + 8, y, contentWidth - 8, secLineHeight, page, bodyFont, secFontSize, lightGray);
        }
      }

      y -= paraSpacing;
    }

    // ── Page numbers ─────────────────────────────────────────────────────────
    const pages = pdfDoc.getPages();
    const total = pages.length;
    for (let i = 0; i < total; i++) {
      const pg = pages[i];
      const { width: pw } = pg.getSize();
      const pageNumText = `Page ${i + 1} / ${total}`;
      pg.drawText(pageNumText, { x: margin, y: margin / 2, size: smallFontSize, font: stdFont, color: lightGray });
      const createdText = 'Created by StudyCards';
      const createdWidth = stdFont.widthOfTextAtSize(createdText, smallFontSize);
      pg.drawText(createdText, { x: pw - margin - createdWidth, y: margin / 2, size: smallFontSize, font: stdFont, color: lightGray });
    }

    const pdfBytes = await pdfDoc.save();
    const safeName = deckName.replace(/[^a-zA-Z0-9_.-]/g, '_');

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}-story.pdf"`,
      },
    });

  } catch (error: any) {
    appLogger.error('[API /generate-story-pdf] Error:', error.message);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
