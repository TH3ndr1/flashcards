import { NextRequest, NextResponse } from 'next/server';
import { createActionClient } from '@/lib/supabase/server';
import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont, RGB } from 'pdf-lib'; // Added RGB type
import type { Database, Tables } from '@/types/database'; // Added Tables type
import { appLogger } from '@/lib/logger';
import * as fs from 'fs'; // For reading font files
import * as path from 'path'; // For constructing file paths
import * as fontkit from 'fontkit'; // Changed to namespace import
// --- BEGIN Import Palettes ---
import { PREDEFINED_PALETTES, DEFAULT_PALETTE_CONFIG } from '@/lib/palettes';
import type { Palette as PaletteType, ColorPair } from '@/lib/palettes'; // PaletteType to avoid conflict
// --- END Import Palettes ---

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
    regular: { type: 'custom', fileName: 'AtkinsonHyperlegibleNext-Regular.otf' },
    // If AtkinsonHyperlegible-Bold.ttf is not available, fallback to a standard bold font
    bold: { type: 'custom', fileName: 'AtkinsonHyperlegibleNext-Bold.otf' },
    // If you add AtkinsonHyperlegible-Bold.ttf, change above to:
    // bold: { type: 'custom', fileName: 'AtkinsonHyperlegible-Bold.ttf' }, 
  },
  'opendyslexic': {
    regular: { type: 'custom', fileName: 'OpenDyslexic-Regular.otf' },
    // If OpenDyslexic-Bold.ttf is not available, fallback to a standard bold font
    bold: { type: 'custom', fileName: 'OpenDyslexic-Bold.otf'},
    // If you add OpenDyslexic-Bold.ttf, change above to:
    // bold: { type: 'custom', fileName: 'OpenDyslexic-Bold.ttf' },
  },
  // Add other font options from your FONT_OPTIONS in lib/fonts.ts here.
  // For each, specify the .fileName for the .ttf file (regular) 
  // and decide on the bold strategy (custom bold .ttf or fallback to HelveticaBold).
};
// --- END FONT CONFIGURATION ---

// Define a type for the expected settings from the request body
interface PdfSettings {
    cardFont: string; // FontOption key
    enablePdfWordColorCoding: boolean;
    pdfCardContentFontSize: number;
    showCardStatusIconsInPdf: boolean;
    wordPaletteConfig: Record<string, Record<string, string>>;
    enableBasicColorCoding: boolean;
    enableAdvancedColorCoding: boolean;
    colorOnlyNonNative: boolean;
    appLanguage: string;
}

// Extended DeckForPdf to include language and card grammatical fields
interface DeckForPdf {
  name: string | null;
  user_id: string;
  primary_language: string | null;
  secondary_language: string | null;
  is_bilingual: boolean | null;
  tags: { name: string }[];
  cards: {
    question: string;
    answer: string;
    id: string;
    question_part_of_speech: string | null;
    question_gender: string | null;
    answer_part_of_speech: string | null;
    answer_gender: string | null;
    srs_level: number;
    learning_state: string | null;
    interval_days: number | null;
  }[];
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
    const resolvedPath = path.join(process.cwd(), FONT_FILES_BASE_PATH, style.fileName);
    try {
      const fontBytes = fs.readFileSync(resolvedPath);
      return await pdfDoc.embedFont(fontBytes);
    } catch (error: any) {
      appLogger.warn(`[PDF Generation] Failed to load custom font: ${style.fileName}. Falling back.`, {
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code,
        errorName: error.name,
        fullErrorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      appLogger.info(`[PDF Generation] Using fallback font for ${style.fileName}.`);
      return await pdfDoc.embedFont(style.fileName.toLowerCase().includes('bold') ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
    }
  } else {
    return await pdfDoc.embedFont(style.standardFont);
  }
}

// --- BEGIN Color Utility Functions ---
function hexToRgbPdf(hex: string): RGB | undefined {
    if (!hex || hex === 'inherit' || hex === 'transparent') return undefined;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        rgb(
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
        ) 
        : undefined;
}

// Modified getPdfWordColor with simplified logging
function getPdfWordColor(
    pos: string | null | undefined,
    gender: string | null | undefined,
    textLanguageCode: string | null | undefined,
    settings: Pick<PdfSettings, 'wordPaletteConfig' | 'enableBasicColorCoding' | 'enableAdvancedColorCoding' | 'colorOnlyNonNative' | 'appLanguage' | 'enablePdfWordColorCoding'>,
    cardIdForLog: string, 
    sideForLog: 'question' | 'answer'
): RGB | undefined {
    const defaultColor = undefined;
    appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Inputs:", { pos, gender, textLanguageCode, settings });

    if (!settings.enablePdfWordColorCoding) {
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - PDF word color coding disabled globally.");
        return defaultColor;
    }
    if (!pos || pos === 'N/A') {
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - No POS or N/A.");
        return defaultColor;
    }
    if (!textLanguageCode) {
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - No textLanguageCode.");
        return defaultColor;
    }

    if (settings.colorOnlyNonNative && settings.appLanguage && textLanguageCode.startsWith(settings.appLanguage.substring(0,2)) && settings.appLanguage.substring(0,2) === textLanguageCode.substring(0,2) ) {
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Skipped: colorOnlyNonNative ON, text lang (" + textLanguageCode + ") matches app lang (" + settings.appLanguage + ").");
        return defaultColor;
    }

    const posKey = pos;
    const isBasicPos = ['Noun', 'Verb'].includes(posKey);
    const isEnabledForPosType = isBasicPos ? settings.enableBasicColorCoding : settings.enableAdvancedColorCoding;

    if (!isEnabledForPosType) {
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Skipped: PoS type '" + (isBasicPos ? 'Basic' : 'Advanced') + "' (" + posKey + ") coloring disabled.");
        return defaultColor;
    }

    const paletteConfig = settings.wordPaletteConfig ?? DEFAULT_PALETTE_CONFIG;
    const genderKey = (gender && gender !== 'N/A' && paletteConfig?.[posKey]?.[gender]) ? gender : 'Default';
    const paletteId = paletteConfig?.[posKey]?.[genderKey] ?? 'default';
    appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Palette lookup:", { posKey, genderKey, paletteId });

    if (paletteId === 'default') {
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Palette ID is 'default'.");
        return defaultColor;
    }

    const selectedPalette = PREDEFINED_PALETTES.find(p => p.id === paletteId);
    if (!selectedPalette) {
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Palette ID '" + paletteId + "' not found.");
        return defaultColor;
    }
    appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Selected Palette:", selectedPalette);

    // Use the .light.background color from the palette as the text color for the PDF
    const backgroundColorHex = selectedPalette.light.background;
    if (backgroundColorHex && backgroundColorHex !== 'inherit' && backgroundColorHex !== 'transparent') {
        const rgbColor = hexToRgbPdf(backgroundColorHex);
        appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - Using light.background ('" + backgroundColorHex + "') as text color, RGB:", rgbColor);
        return rgbColor;
    }
    appLogger.debug("[getPdfWordColor] Card " + cardIdForLog + " (" + sideForLog + ") - No valid light.background color found in palette.");
    return defaultColor;
}
// --- END Color Utility Functions ---

// Helper function to draw the footer legend, right-aligned
async function drawFooterLegend(
    pageToDrawOn: any, // pdf-lib Page object
    pageWidth: number,
    pageMargin: number,
    baseFooterY: number, // Y level for the footer elements
    iconFt: PDFFont,      // Icon font (fa-solid-900.ttf)
    stdFont: PDFFont,     // Standard font for legend text (Helvetica)
    fSizeSmall: number
) {
    const STATUS_ICON = String.fromCharCode(0xf111); // fa-solid fa-circle
    const legendIconSz = fSizeSmall * 0.7;
    const legendTxtGap = 3;
    const legendInterItmGap = 10;

    const items = [
        { text: 'New', color: rgb(0.937, 0.267, 0.267) },      // NEW_COLOR
        { text: 'Learning', color: rgb(0.576, 0.325, 0.867) }, // LEARNING_COLOR
        { text: 'Relearning', color: rgb(0.976, 0.451, 0.086) },// RELEARNING_COLOR
        { text: 'Young', color: rgb(0.325, 0.525, 0.867) },    // YOUNG_COLOR
        { text: 'Mature', color: rgb(0.325, 0.867, 0.867) },   // MATURE_COLOR
    ];

    let currentXDraw = pageWidth - pageMargin;
    const legendYDraw = baseFooterY; // Legend will be on the same line as page number

    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const textWidth = stdFont.widthOfTextAtSize(item.text, fSizeSmall);
        const iconWidth = iconFt.widthOfTextAtSize(STATUS_ICON, legendIconSz);

        currentXDraw -= textWidth;
        pageToDrawOn.drawText(item.text, {
            x: currentXDraw,
            y: legendYDraw,
            font: stdFont,
            size: fSizeSmall,
            color: rgb(0.3, 0.3, 0.3), // Dark gray for legend text
        });

        currentXDraw -= legendTxtGap;
        currentXDraw -= iconWidth;
        pageToDrawOn.drawText(STATUS_ICON, {
            x: currentXDraw,
            y: legendYDraw,
            font: iconFt,
            size: legendIconSz,
            color: item.color,
        });

        if (i > 0) { // Add gap if not the last item (first in reverse iteration)
            currentXDraw -= legendInterItmGap;
        }
    }
}

// --- BEGIN NEW HELPER: Draw Column Headers and Line ---
async function drawColumnTitlesAndRule(
    page: any,
    yPos: number, // Baseline for the header text
    pageMargin: number,
    pageWidth: number,
    questionColumnWidth: number,
    answerColumnWidth: number,
    stageColumnWidth: number,
    columnGap: number,
    gapBetweenAnswerAndStage: number,
    headerLineHeight: number, // Line height for the header text itself (e.g., headerFontSize * 1.2)
    font: PDFFont,
    headerFontSize: number, // Font size of the header text
    color: RGB
): Promise<number> {
    const headerTextBaselineY = yPos;

    // Draw column headers using headerFontSize
    // The 'headerLineHeight' is passed to drawTextWithWrapping for its internal line breaking logic.
    await drawTextWithWrapping('Question', pageMargin, headerTextBaselineY, questionColumnWidth, headerLineHeight, page, font, headerFontSize, color);
    await drawTextWithWrapping('Answer', pageMargin + questionColumnWidth + columnGap, headerTextBaselineY, answerColumnWidth, headerLineHeight, page, font, headerFontSize, color);
    const stageHeaderXCalculated = pageMargin + questionColumnWidth + columnGap + answerColumnWidth + gapBetweenAnswerAndStage;
    await drawTextWithWrapping('Stage', stageHeaderXCalculated, headerTextBaselineY, stageColumnWidth, headerLineHeight, page, font, headerFontSize, color);
    
    // Calculate Y for the line: a bit below the header text baseline.
    // Using headerFontSize to make the gap proportional to the text.
    const lineOffsetYBelowTextBaseline = headerFontSize * 0.4; // Increased from 0.25
    const lineY = headerTextBaselineY - lineOffsetYBelowTextBaseline;

    // Draw solid line underneath headers
    page.drawLine({
        start: { x: pageMargin, y: lineY },
        end: { x: pageWidth - pageMargin, y: lineY },
        thickness: 0.5, // Changed from 0.75
        color: rgb(0.7, 0.7, 0.7), // Changed from rgb(0.2, 0.2, 0.2)
    });
    
    // Space after the line, before the next content starts.
    // Use headerLineHeight (which is typically headerFontSize * 1.2) to calculate a proportional padding.
    const paddingAfterLine = headerLineHeight * 1.3; // Increased from 1.0 
    let nextContentY = lineY - paddingAfterLine;

    return nextContentY;
}
// --- END NEW HELPER ---

export async function POST(req: NextRequest) {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      appLogger.warn('[API /generate-deck-pdf] Authentication error or no user', { error: userError?.message });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    // Correctly destructure ALL expected properties from PdfSettings, including showCardStatusIconsInPdf
    const {
        deckId,
        cardFont,
        enablePdfWordColorCoding,
        pdfCardContentFontSize,
        showCardStatusIconsInPdf, // <<< THE CRUCIAL FIX IS ENSURING THIS IS HERE
        wordPaletteConfig,
        enableBasicColorCoding,
        enableAdvancedColorCoding,
        colorOnlyNonNative,
        appLanguage,
    } = body as PdfSettings & { deckId: string };

    appLogger.debug("[API /generate-deck-pdf] Received settings for PDF generation:", {
        deckId,
        userCardFontChoice: cardFont,
        enablePdfWordColorCoding,
        pdfCardContentFontSize,
        showCardStatusIconsInPdf, // This will now log the actual boolean value from the request
        enableBasicColorCoding,
        enableAdvancedColorCoding,
        colorOnlyNonNative,
        appLanguage,
    });
    appLogger.debug("[API /generate-deck-pdf] Received wordPaletteConfig:", wordPaletteConfig);

    if (!deckId) {
      return NextResponse.json({ error: 'deckId is required.' }, { status: 400 });
    }
    if (typeof pdfCardContentFontSize !== 'number' || pdfCardContentFontSize < 6 || pdfCardContentFontSize > 24) {
        return NextResponse.json({ error: 'Invalid pdfCardContentFontSize.' }, { status: 400 });
    }

    const selectedFontKey = (cardFont && FONT_CONFIG_MAP[cardFont]) ? cardFont : 'default';
    const fontChoiceConfig = FONT_CONFIG_MAP[selectedFontKey];

    const { data: fetchedDeckData, error: fetchError } = await supabase
      .from('decks')
      .select(`
        name,
        user_id,
        primary_language,
        secondary_language,
        is_bilingual,
        tags (name),
        cards (
          id,
          question,
          answer,
          question_part_of_speech,
          question_gender,
          answer_part_of_speech,
          answer_gender,
          srs_level,
          learning_state,
          interval_days
        )
      `)
      .eq('id', deckId)
      .eq('user_id', user.id)
      .single();

    if (fetchedDeckData) {
        appLogger.debug('[API /generate-deck-pdf] Fetched deck details:', {
            name: fetchedDeckData.name,
            primary_language: fetchedDeckData.primary_language,
            secondary_language: fetchedDeckData.secondary_language,
            is_bilingual: fetchedDeckData.is_bilingual,
            tags_count: fetchedDeckData.tags?.length,
            cards_count: fetchedDeckData.cards?.length
        });
        if (fetchedDeckData.cards && fetchedDeckData.cards.length > 0) {
             appLogger.debug('[API /generate-deck-pdf] First card details:', {
                id: fetchedDeckData.cards[0].id,
                q_pos: fetchedDeckData.cards[0].question_part_of_speech,
                q_gender: fetchedDeckData.cards[0].question_gender,
                a_pos: fetchedDeckData.cards[0].answer_part_of_speech,
                a_gender: fetchedDeckData.cards[0].answer_gender,
                srs_level: fetchedDeckData.cards[0].srs_level,
                learning_state: fetchedDeckData.cards[0].learning_state
             });
        }
    } else if (fetchError) {
        appLogger.error('[API /generate-deck-pdf] Error fetching deck (pre-check):', { deckId, userId: user.id, error: fetchError.message });
    }

    if (fetchError) {
      appLogger.error('[API /generate-deck-pdf] Error fetching deck:', { deckId, userId: user.id, error: fetchError.message });
      const status = fetchError.code === 'PGRST116' ? 404 : 500;
      return NextResponse.json({ error: `Failed to fetch deck: ${fetchError.message}` }, { status });
    }

    const deckData = fetchedDeckData as DeckForPdf | null;

    if (!deckData) {
      appLogger.info('[API /generate-deck-pdf] Deck not found or access denied', { deckId, userId: user.id });
      return NextResponse.json({ error: 'Deck not found or access denied.' }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Load the main content font (user selected)
    const mainContentFont = await loadFont(pdfDoc, fontChoiceConfig.regular);
    const mainContentFontBold = await loadFont(pdfDoc, fontChoiceConfig.bold);

    // Load Standard fonts for UI elements
    const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const standardFontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let iconFont: PDFFont;
    try {
        // Attempt to load fa-solid-900.ttf for filled circles
        const iconFontBytes = fs.readFileSync(path.join(process.cwd(), FONT_FILES_BASE_PATH, 'fa-solid-900.ttf'));
        iconFont = await pdfDoc.embedFont(iconFontBytes);
        appLogger.debug("[API /generate-deck-pdf] Successfully loaded icon font: fa-solid-900.ttf");
    } catch (e) {
        appLogger.error("[API /generate-deck-pdf] Failed to load icon font fa-solid-900.ttf. Icons may not render correctly or fallback will be used.", e);
        // Fallback if solid font is not found, though icons might be outlined
        try {
            const regularIconFontBytes = fs.readFileSync(path.join(process.cwd(), FONT_FILES_BASE_PATH, 'fa-regular-400.ttf'));
            iconFont = await pdfDoc.embedFont(regularIconFontBytes);
            appLogger.warn("[API /generate-deck-pdf] Loaded fa-regular-400.ttf as fallback icon font.");
        } catch (e2) {
            appLogger.error("[API /generate-deck-pdf] Failed to load fa-regular-400.ttf as fallback. Using Helvetica for icons.", e2);
            iconFont = await pdfDoc.embedFont(StandardFonts.Helvetica); // Absolute fallback
        }
    }

    let page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    const fontSizeTitle = 16;
    const defaultFontSizeRegular = 10;
    const fontSizeSmall = 9;

    const fixedReferenceLineHeight = defaultFontSizeRegular * 1.2;
    const creationDateString = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); // Define once

    const margin = 40;
    const lineHeightTitle = fontSizeTitle * 1.2;
    const lineHeightRegular = defaultFontSizeRegular * 1.2;
    const qaLineHeight = pdfCardContentFontSize * 1.2;
    const footerLineHeight = fontSizeSmall * 1.2;
    const columnGap = 15;
    const stageColumnWidth = 40; 
    const gapBetweenAnswerAndStage = 20; 
    const questionAnswerContentWidth = width - 2 * margin - stageColumnWidth - columnGap - gapBetweenAnswerAndStage; 
    const questionColumnWidth = (questionAnswerContentWidth) / 2;
    const answerColumnWidth = (questionAnswerContentWidth) / 2;
    let currentY = height - margin;

    // Calculate stageHeaderX once, as it depends on fixed layout parameters
    const stageHeaderX = margin + questionColumnWidth + columnGap + answerColumnWidth + gapBetweenAnswerAndStage;

    // Capture the Y-coordinate for the deck title's baseline
    const deckTitleBaselineY = currentY; 

    const titleAndTagMaxWidth = margin + questionColumnWidth + columnGap + answerColumnWidth; // Max width before the gap to stage column
    currentY = await drawTextWithWrapping(deckData.name || 'Untitled Deck', margin, deckTitleBaselineY, titleAndTagMaxWidth, lineHeightTitle, page, standardFontBold, fontSizeTitle, rgb(0,0,0));
    currentY -= lineHeightTitle * 0.5;
    if (deckData.tags && deckData.tags.length > 0) {
      const tagsString = "Tags: " + deckData.tags.map((t: { name: string }) => t.name).join(', ');
      currentY = await drawTextWithWrapping(tagsString, margin, currentY, titleAndTagMaxWidth, lineHeightRegular, page, standardFont, defaultFontSizeRegular, rgb(0.3, 0.3, 0.3));
      currentY -= lineHeightRegular;
    }

    // Draw Column Headers and Rule for the first page
    currentY = await drawColumnTitlesAndRule(
        page,
        currentY,
        margin,
        width,
        questionColumnWidth,
        answerColumnWidth,
        stageColumnWidth,
        columnGap,
        gapBetweenAnswerAndStage,
        lineHeightRegular, // Using lineHeightRegular for headers
        standardFontBold,
        defaultFontSizeRegular,
        rgb(0.1,0.1,0.1)
    );

    const defaultTextColor = rgb(0,0,0);
    const footerColor = rgb(0.5, 0.5, 0.5);

    const STATUS_ICON_CHAR = String.fromCharCode(0xf111); // fa-solid fa-circle
    const iconSize = pdfCardContentFontSize * 0.6; // Make icon a bit smaller relative to text

    // Define Icon Colors based on your progress bar
    const NEW_COLOR = rgb(0.937, 0.267, 0.267); // approx #EF4444 (Red)
    const LEARNING_COLOR = rgb(0.576, 0.325, 0.867); // approx #9353DD (Purple)
    const RELEARNING_COLOR = rgb(0.976, 0.451, 0.086); // approx #F97316 (Orange)
    const YOUNG_COLOR = rgb(0.325, 0.525, 0.867); // approx #5386DD (Blue/Purple) - Placeholder for Reviewed
    const MATURE_COLOR = rgb(0.325, 0.867, 0.867); // approx #53DDDD (Teal/Cyan)

    // Calculate X-coordinate for the status icon column (center of stageColumnWidth)
    // Ensure iconFont is defined before using its methods; it should be by now due to try/catch/fallback
    const iconWidth = iconFont ? iconFont.widthOfTextAtSize(STATUS_ICON_CHAR, iconSize) : 0;
    const statusIconColumnCenterX = stageHeaderX + (stageColumnWidth / 2) - (iconWidth / 2);

    if (deckData.cards && deckData.cards.length > 0) {
      for (const card of deckData.cards) {
        let questionText = card.question || '';
        let answerText = card.answer || '';
        const iconYAdjustment = qaLineHeight * 0.12; // Fine-tune vertical alignment 

        let iconColorToUse: RGB | undefined = undefined;

        if (showCardStatusIconsInPdf) {
          if (card.srs_level === 0 && (card.learning_state === null || card.learning_state === undefined || card.learning_state === '')) {
            iconColorToUse = NEW_COLOR; // New
          } else if (card.srs_level === 0 && card.learning_state === 'learning') {
            iconColorToUse = LEARNING_COLOR; // Learning
          } else if (card.srs_level === 0 && card.learning_state === 'relearning') {
            iconColorToUse = RELEARNING_COLOR; // Relearning
          } else if (card.srs_level > 0) {
            // Simplified: For now, all srs_level > 0 are "Young" color. 
            // TODO: Differentiate Young/Mature if card.interval_days and settings.mature_interval_threshold are available
            iconColorToUse = YOUNG_COLOR; // Reviewed (Young/Mature placeholder)
          }
        }
        
        let questionColor = defaultTextColor;
        let answerColor = defaultTextColor;

        appLogger.debug("[API /generate-deck-pdf] Processing Card ID: " + card.id, {
            qText: questionText.substring(0, 50) + (questionText.length > 50 ? "..." : ""),
            qPos: card.question_part_of_speech,
            qGender: card.question_gender,
            aText: answerText.substring(0,50) + (answerText.length > 50 ? "..." : ""),
            aPos: card.answer_part_of_speech,
            aGender: card.answer_gender
        });

        if (enablePdfWordColorCoding) {
            const settingsForColoring = {
                wordPaletteConfig,
                enableBasicColorCoding,
                enableAdvancedColorCoding,
                colorOnlyNonNative,
                appLanguage,
                enablePdfWordColorCoding
            };

            const questionLangForColoring = deckData.primary_language;
            const answerLangForColoring = deckData.is_bilingual && deckData.secondary_language ? deckData.secondary_language : deckData.primary_language;

            appLogger.debug("[API /generate-deck-pdf] Language for Card ID " + card.id + ": QLang='" + questionLangForColoring + "', ALang='" + answerLangForColoring + "'");

            questionColor = getPdfWordColor(card.question_part_of_speech, card.question_gender, questionLangForColoring, settingsForColoring, card.id, 'question') || defaultTextColor;
            answerColor = getPdfWordColor(card.answer_part_of_speech, card.answer_gender, answerLangForColoring, settingsForColoring, card.id, 'answer') || defaultTextColor;

            appLogger.debug("[API /generate-deck-pdf] Card ID " + card.id + " - Final Colors - Q:", questionColor, "A:", answerColor);
        } else {
            appLogger.debug("[API /generate-deck-pdf] PDF word color coding globally disabled. Card ID: " + card.id + " will use default text color.");
        }

        // --- Calculate text heights and manage pagination --- 
        const tempPdfDocForCalc = await PDFDocument.create();
        tempPdfDocForCalc.registerFontkit(fontkit);
        const tempFontForCalc = await loadFont(tempPdfDocForCalc, fontChoiceConfig.regular);
        const tempPageForHeightCalc = tempPdfDocForCalc.addPage([width, height]); 
        const qHeight = height - (await drawTextWithWrapping(questionText, 0, height, questionColumnWidth, qaLineHeight, tempPageForHeightCalc, tempFontForCalc, pdfCardContentFontSize, questionColor));
        const aHeight = height - (await drawTextWithWrapping(answerText, 0, height, answerColumnWidth, qaLineHeight, tempPageForHeightCalc, tempFontForCalc, pdfCardContentFontSize, answerColor));
        const cardBottomPadding = fixedReferenceLineHeight * 0.5;
        const cardRowHeight = Math.max(qHeight, aHeight) + cardBottomPadding;

        if (currentY - cardRowHeight < margin + footerLineHeight * 2) { // Check space for content + potential single footer line (page num/legend)
            // DO NOT DRAW FOOTERS/HEADERS HERE ANYMORE
            // const creationDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            // page.drawText('Created by StudyCards on ' + creationDate, { x: margin, y: margin / 2, size: fontSizeSmall, font: standardFont, color: footerColor });
            // page.drawText(String(pdfDoc.getPageCount()), { x: width - margin - standardFont.widthOfTextAtSize(String(pdfDoc.getPageCount()), fontSizeSmall), y: margin / 2, size: fontSizeSmall, font: standardFont, color: footerColor });
            
            // DO NOT DRAW LEGEND HERE ANYMORE
            // await drawFooterLegend(page, pdfDoc, width, margin, margin / 2, footerLineHeight, iconFont, standardFont, fontSizeSmall);

            page = pdfDoc.addPage(PageSizes.A4);
            currentY = height - margin; // Reset Y for new page
            // Draw Column Headers and Rule for the new page
            currentY = await drawColumnTitlesAndRule(
                page,
                currentY,
                margin,
                width, // Assuming width is same for new page, which it is with PageSizes.A4
                questionColumnWidth,
                answerColumnWidth,
                stageColumnWidth,
                columnGap,
                gapBetweenAnswerAndStage, // This now correctly uses the global stageHeaderX
                lineHeightRegular, // Using lineHeightRegular for headers
                standardFontBold,
                defaultFontSizeRegular,
                rgb(0.1,0.1,0.1)
            );
            // Removed old column header drawing + currentY adjustment below for new page
        }

        const startYForRow = currentY;
        await drawTextWithWrapping(questionText, margin, startYForRow, questionColumnWidth, qaLineHeight, page, mainContentFont, pdfCardContentFontSize, questionColor);
        await drawTextWithWrapping(answerText, margin + questionColumnWidth + columnGap, startYForRow, answerColumnWidth, qaLineHeight, page, mainContentFont, pdfCardContentFontSize, answerColor);
        
        if (showCardStatusIconsInPdf && iconColorToUse) {
            page.drawText(STATUS_ICON_CHAR, {
                x: statusIconColumnCenterX,
                y: startYForRow - iconYAdjustment, 
                font: iconFont, 
                size: iconSize,
                color: iconColorToUse,
            });
        }

        currentY -= cardRowHeight;

        if (deckData.cards.indexOf(card) < deckData.cards.length -1 ) {
            const lineY = currentY + (qaLineHeight);
            page.drawLine({
                start: { x: margin, y: lineY },
                end: { x: width - margin, y: lineY },
                thickness: 0.5,
                color: rgb(0.75, 0.75, 0.75),
                dashArray: [2, 2],
                dashPhase: 0,
            });
        }
      }
    }

    // --- BEGIN FINAL FOOTER/HEADER DRAWING LOOP ---
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
        const currentPageObject = pages[i];
        const currentPageNum = i + 1;
        const { width: pageWidthForFooter, height: pageHeightForFooter } = currentPageObject.getSize(); // Use current page's dimensions

        // Header: "Created by StudyCards on <date>" - Top Right
        // Only draw on the first page
        if (currentPageNum === 1) {
            const createdByText = 'Created by StudyCards on ' + creationDateString;
            const createdByTextWidth = standardFont.widthOfTextAtSize(createdByText, fontSizeSmall);
            currentPageObject.drawText(createdByText, {
                x: pageWidthForFooter - margin - createdByTextWidth,
                y: deckTitleBaselineY, // Align with the deck title's baseline
                size: fontSizeSmall,
                font: standardFont,
                color: footerColor,
            });
        }
        
        // Footer: "Page X / Y" - Bottom Left
        const pageNumText = 'Page ' + currentPageNum + ' / ' + totalPages;
        currentPageObject.drawText(pageNumText, {
            x: margin,
            y: margin / 2,
            size: fontSizeSmall,
            font: standardFont,
            color: footerColor,
        });

        // Footer: Legend - Bottom Right (on the same line as page number)
        await drawFooterLegend(
            currentPageObject,
            pageWidthForFooter,
            margin,
            margin / 2, // baseFooterY
            iconFont,
            standardFont,
            fontSizeSmall
        );
    }
    // --- END FINAL FOOTER/HEADER DRAWING LOOP ---

    const pdfBytesToSave = await pdfDoc.save();
    const safeDeckName = (deckData.name || 'deck').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const contentDispositionValue = 'attachment; filename="' + safeDeckName + '.pdf"';

    return new NextResponse(pdfBytesToSave, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionValue,
      },
    });

  } catch (error: any) {
    appLogger.error('[API /generate-deck-pdf] Unexpected error:', {
      errorMessage: error.message,
      errorStack: error.stack,
      fullErrorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    return NextResponse.json({ error: 'Failed to generate PDF.', details: error.message }, { status: 500 });
  }
}