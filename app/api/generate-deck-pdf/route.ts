import { NextRequest, NextResponse } from 'next/server';
import { createActionClient } from '@/lib/supabase/server';
import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont } from 'pdf-lib'; // Added PDFFont type
import type { Database } from '@/types/database';
import { appLogger } from '@/lib/logger';
import * as fs from 'fs'; // For reading font files
import * as path from 'path'; // For constructing file paths

// --- BEGIN FONT CONFIGURATION ---
// Assuming CONVERTED .ttf or .otf files will be placed here from your .woff2 files
const FONT_FILES_BASE_PATH = 'public/fonts/'; 

interface FontStylePath {
  type: 'custom';
  fileName: string;
}
interface FontStyleStandard {
  type: 'standard';
  standardFont: StandardFonts;
}

interface FontChoiceConfig {
  regular: FontStylePath | FontStyleStandard;
  bold: FontStylePath | FontStyleStandard;
}

// Maps cardFont setting values to font configurations
// IMPORTANT: Ensure .ttf or .otf files (converted from your .woff2) exist for each custom font.
const FONT_CONFIG_MAP: Record<string, FontChoiceConfig> = {
  'default': {
    regular: { type: 'standard', standardFont: StandardFonts.Helvetica },
    bold: { type: 'standard', standardFont: StandardFonts.HelveticaBold },
  },
  'atkinson': {
    regular: { type: 'custom', fileName: 'AtkinsonHyperlegible-Regular.ttf' },
    // If AtkinsonHyperlegible-Bold.ttf is not available, fallback to a standard bold font
    bold: { type: 'standard', standardFont: StandardFonts.HelveticaBold }, 
    // If you add AtkinsonHyperlegible-Bold.ttf, change above to:
    // bold: { type: 'custom', fileName: 'AtkinsonHyperlegible-Bold.ttf' }, 
  },
  'opendyslexic': {
    regular: { type: 'custom', fileName: 'OpenDyslexic-Regular.ttf' },
    // If OpenDyslexic-Bold.ttf is not available, fallback to a standard bold font
    bold: { type: 'standard', standardFont: StandardFonts.HelveticaBold },
    // If you add OpenDyslexic-Bold.ttf, change above to:
    // bold: { type: 'custom', fileName: 'OpenDyslexic-Bold.ttf' },
  },
  // Add other font options from your FONT_OPTIONS in lib/fonts.ts here.
  // For each, specify the .fileName for the .ttf file (regular) 
  // and decide on the bold strategy (custom bold .ttf or fallback to HelveticaBold).
};
// --- END FONT CONFIGURATION ---

// Define a type for the expected deck data structure
interface DeckForPdf {
  name: string | null;
  user_id: string;
  tags: { name: string }[];
  cards: { question: string; answer: string; id: string }[];
}

// Helper function for drawing text with wrapping (same as used in the Edge Function)
async function drawTextWithWrapping(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    page: any, // pdf-lib Page object
    font: any, // pdf-lib Font object
    fontSize: number,
    color: any // pdf-lib Color object
): Promise<number> {
    const words = text.split(' ');
    let currentLine = '';
    let currentY = y;

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentY < 0 + lineHeight) {
                console.warn("Content exceeds page boundary, stopping text draw.");
                return currentY;
            }
            page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
            currentY -= lineHeight;
            currentLine = word;
        }
    }
    if (currentLine) {
        if (currentY < 0 + lineHeight) {
            console.warn("Content exceeds page boundary, stopping last line draw.");
            return currentY;
        }
        page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
        currentY -= lineHeight;
    }
    return currentY;
}

// Helper function to load a font
async function loadFont(pdfDoc: PDFDocument, style: FontStylePath | FontStyleStandard): Promise<PDFFont> {
  if (style.type === 'custom') {
    try {
      const fontPath = path.join(process.cwd(), FONT_FILES_BASE_PATH, style.fileName);
      const fontBytes = fs.readFileSync(fontPath);
      return await pdfDoc.embedFont(fontBytes);
    } catch (error) {
      appLogger.warn(`[PDF Generation] Failed to load custom font: ${style.fileName}. Falling back.`, { error });
      // Fallback to Helvetica if custom font fails to load
      return await pdfDoc.embedFont(style.fileName.toLowerCase().includes('bold') ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
    }
  } else {
    return await pdfDoc.embedFont(style.standardFont);
  }
}

export async function POST(req: NextRequest) {
  try {
    // const cookieStore = cookies(); // No longer needed directly here
    // Initialize Supabase client using createActionClient from the project's lib
    const supabase = createActionClient();
    /*
    const supabase = createServerClient<Database>( // Old implementation
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          // set and remove can be added if the route needs to modify cookies, though not for this GET session & POST data case
          // set(name: string, value: string, options: CookieOptions) { cookieStore.set(name, value, options); }
          // remove(name: string, options: CookieOptions) { cookieStore.delete(name, options); }
        },
      }
    );
    */

    // const { data: { session }, error: sessionError } = await supabase.auth.getSession(); // Old way
    const { data: { user }, error: userError } = await supabase.auth.getUser(); // New, more secure way

    // if (sessionError || !session) { // Old way
    if (userError || !user) { // New way
      appLogger.warn('[API /generate-deck-pdf] Authentication error or no user', { error: userError?.message });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { deckId, cardFont: userCardFontChoice } = body;

    if (!deckId) {
      return NextResponse.json({ error: 'deckId is required in the request body.' }, { status: 400 });
    }

    // Determine font configuration - fallback to 'default' if choice is invalid or not provided
    const selectedFontKey = (userCardFontChoice && FONT_CONFIG_MAP[userCardFontChoice]) ? userCardFontChoice : 'default';
    const fontChoiceConfig = FONT_CONFIG_MAP[selectedFontKey];

    const { data: fetchedDeckData, error: fetchError } = await supabase
      .from('decks')
      .select('name, user_id, tags (name), cards (question, answer, id)')
      .eq('id', deckId)
      .eq('user_id', user.id) // Use user.id from getUser()
      .single();

    if (fetchError) {
      appLogger.error('[API /generate-deck-pdf] Error fetching deck:', { deckId, userId: user.id, error: fetchError.message }); // Use user.id
      const status = fetchError.code === 'PGRST116' ? 404 : 500; // PGRST116: Row not found
      return NextResponse.json({ error: `Failed to fetch deck: ${fetchError.message}` }, { status });
    }

    const deckData = fetchedDeckData as DeckForPdf | null;

    if (!deckData) {
      appLogger.info('[API /generate-deck-pdf] Deck not found or access denied', { deckId, userId: user.id }); // Use user.id
      return NextResponse.json({ error: 'Deck not found or access denied.' }, { status: 404 });
    }

    // PDF Generation
    const pdfDoc = await PDFDocument.create();
    
    // Load the selected fonts
    const font = await loadFont(pdfDoc, fontChoiceConfig.regular);
    const fontBold = await loadFont(pdfDoc, fontChoiceConfig.bold);
    
    let page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    const fontSizeTitle = 16;
    const fontSizeRegular = 10;
    const fontSizeSmall = 9;
    const margin = 40;
    const lineHeightTitle = fontSizeTitle * 1.2;
    const lineHeightRegular = fontSizeRegular * 1.2;
    const lineHeightSmall = fontSizeSmall * 1.2;
    const footerLineHeight = fontSizeSmall * 1.2; // For footer text
    const columnGap = 15;
    const contentWidth = width - 2 * margin;
    const columnWidth = (contentWidth - columnGap) / 2;
    let currentY = height - margin;

    // Deck Title
    currentY = await drawTextWithWrapping(deckData.name || 'Untitled Deck', margin, currentY, contentWidth, lineHeightTitle, page, fontBold, fontSizeTitle, rgb(0,0,0));
    currentY -= lineHeightTitle * 0.5; // Space after title

    // Tags
    if (deckData.tags && deckData.tags.length > 0) {
      const tagsString = `Tags: ${deckData.tags.map((t: { name: string }) => t.name).join(', ')}`;
      currentY = await drawTextWithWrapping(tagsString, margin, currentY, contentWidth, lineHeightRegular, page, font, fontSizeRegular, rgb(0.3, 0.3, 0.3));
      currentY -= lineHeightRegular; // Space after tags
    }
    
    // Line separator
    page.drawLine({ start: { x: margin, y: currentY }, end: { x: width - margin, y: currentY }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    currentY -= lineHeightRegular;

    // Column Headers
    const columnHeaderY = currentY;
    await drawTextWithWrapping('Question', margin, columnHeaderY, columnWidth, lineHeightRegular, page, fontBold, fontSizeRegular, rgb(0.1,0.1,0.1));
    await drawTextWithWrapping('Answer', margin + columnWidth + columnGap, columnHeaderY, columnWidth, lineHeightRegular, page, fontBold, fontSizeRegular, rgb(0.1,0.1,0.1));
    currentY -= lineHeightRegular * 1.5; // Space after column headers

    // Cards
    if (deckData.cards && deckData.cards.length > 0) {
      for (const card of deckData.cards) {
        const questionText = card.question || '';
        const answerText = card.answer || '';

        const tempPdfDocForCalc = await PDFDocument.create();
        // Use a temporary page with the same dimensions for accurate height calculation
        const tempPageForHeightCalc = tempPdfDocForCalc.addPage(PageSizes.A4); 

        const questionHeight = height - (await drawTextWithWrapping(questionText, 0, height, columnWidth, lineHeightSmall, tempPageForHeightCalc, font, fontSizeSmall, rgb(0,0,0)));
        const answerHeight = height - (await drawTextWithWrapping(answerText, 0, height, columnWidth, lineHeightSmall, tempPageForHeightCalc, font, fontSizeSmall, rgb(0,0,0)));
        // Calculate card entry height: max text height + one full lineHeightSmall for the gap where the line is centered.
        const cardEntryHeight = Math.max(questionHeight, answerHeight) + lineHeightSmall; 

        // Check if there's enough space for the card AND a footer line
        if (currentY - cardEntryHeight - footerLineHeight < margin) { 
            page = pdfDoc.addPage(PageSizes.A4);
            currentY = height - margin;
            // Redraw column headers on new page
            const newPageColHeaderY = currentY;
            await drawTextWithWrapping('Question', margin, newPageColHeaderY, columnWidth, lineHeightRegular, page, fontBold, fontSizeRegular, rgb(0.1,0.1,0.1));
            await drawTextWithWrapping('Answer', margin + columnWidth + columnGap, newPageColHeaderY, columnWidth, lineHeightRegular, page, fontBold, fontSizeRegular, rgb(0.1,0.1,0.1));
            currentY -= lineHeightRegular * 1.5;
        }

        const yPosForCard = currentY;
        const qEndY = await drawTextWithWrapping(questionText, margin, yPosForCard, columnWidth, lineHeightSmall, page, font, fontSizeSmall, rgb(0,0,0));
        const aEndY = await drawTextWithWrapping(answerText, margin + columnWidth + columnGap, yPosForCard, columnWidth, lineHeightSmall, page, font, fontSizeSmall, rgb(0,0,0));
        
        const yTextEnd = Math.min(qEndY, aEndY); // Y-coordinate for the baseline of an imaginary line immediately following the current card's text block.

        // Position the line. If yTextEnd was perceived as too low, add a positive offset to move it up.
        const upwardShift = lineHeightSmall * 0.25; // Adjust this value to fine-tune: positive moves line up.
        const lineY = yTextEnd + upwardShift;
        
        page.drawLine({
            start: { x: margin, y: lineY }, 
            end: { x: width - margin, y: lineY },
            thickness: 0.5,
            color: rgb(0.6, 0.6, 0.6),
            dashArray: [2, 2], // Dotted line pattern: 2 units on, 2 units off
            opacity: 0.7,
        });
        
        // Update currentY to be the starting position for the *next* card.
        // This should be yTextEnd minus the total gap allocated (which is lineHeightSmall).
        currentY = yTextEnd - lineHeightSmall; 

      }
    } else {
      currentY = await drawTextWithWrapping('This deck has no cards.', margin, currentY, contentWidth, lineHeightRegular, page, font, fontSizeRegular, rgb(0.5,0.5,0.5));
    }

    // Footer: Page numbers and creation date
    const today = new Date();
    const dateString = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const creationText = `Created by StudyCards on ${dateString}`;
    
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
        const currentPage = pages[i];
        const pageNumberText = `Page ${i + 1} of ${pages.length}`;
        const textWidthPageNum = font.widthOfTextAtSize(pageNumberText, fontSizeSmall);

        // Left footer: Creation date
        currentPage.drawText(creationText, {
            x: margin,
            y: margin / 2, // Position in the lower margin
            font: font,
            size: fontSizeSmall,
            color: rgb(0.4, 0.4, 0.4),
        });

        // Right footer: Page number
        currentPage.drawText(pageNumberText, {
            x: width - margin - textWidthPageNum,
            y: margin / 2, // Position in the lower margin
            font: font,
            size: fontSizeSmall,
            color: rgb(0.4, 0.4, 0.4),
        });
    }

    const pdfBytes = await pdfDoc.save();
    const safeDeckName = (deckData.name || 'deck').replace(/[^\\w\\s.-]/g, '_');

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeDeckName}.pdf"`,
      },
    });

  } catch (err: unknown) {
    let errorMessage = 'An unexpected error occurred while generating the PDF.';
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    appLogger.error('[API /generate-deck-pdf] Unexpected error:', { error: err instanceof Error ? err.stack : err });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 