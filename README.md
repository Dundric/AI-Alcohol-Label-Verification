# AI Alcohol Label Verification

A Next.js 14 prototype application for verifying alcohol label information using AI-powered OCR technology.

## Features

- **Three Main Routes:**
  - `/` - Instructions and system overview
  - `/upload` - Single and batch image upload with expected data entry
  - `/review` - Side-by-side comparison of extracted vs. expected data

- **Validated Fields:**
  - Brand Name (fuzzy matching with normalization)
  - Class/Type (product classification)
  - ABV - Alcohol by Volume (numeric comparison with tolerance)
  - Net Contents (volume with unit verification)
  - Government Warning (exact match required for compliance)

- **Advanced Comparison:**
  - Fuzzy brand matching using Levenshtein distance
  - Normalization of capitalization and punctuation
  - Status indicators: ✅ Pass / ⚠️ Warning / ❌ Fail

- **User Experience:**
  - Accessible UI with ARIA attributes
  - Progress indicators for batch processing
  - Responsive design with Tailwind CSS
  - Dark mode support

## Technology Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Zod** for schema validation
- **Mocked OCR** for fast extraction (demo purposes)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Dundric/AI-Alcohol-Label-Verification.git
cd AI-Alcohol-Label-Verification
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Read Instructions:** Start at the home page to understand how the system works
2. **Upload Images:** Navigate to `/upload` and:
   - Select single or batch mode
   - Upload image(s) of alcohol labels
   - Enter expected label data for comparison
   - Click "Process & Verify Labels"
3. **Review Results:** View detailed comparison results at `/review`:
   - See summary statistics
   - Select different images (in batch mode)
   - Compare side-by-side expected vs. extracted data
   - View field-by-field verification status

## Project Structure

```
/app
  /upload          # Upload page with form
  /review          # Review page with comparison
  layout.tsx       # Root layout with navigation
  page.tsx         # Home page with instructions
  globals.css      # Global styles
/lib
  schemas.ts       # Zod schemas for validation
  ocr.ts           # Mocked OCR extraction
  compare.ts       # Comparison and verification logic
```

## Mock OCR Data

The system includes pre-configured mock data for common alcohol types:
- Whiskey (Jack Daniel's)
- Wine (Chateau Margaux)
- Beer (Budweiser)
- Vodka (Grey Goose)
- Rum (Captain Morgan)

The mock selects data based on the filename. For production use, integrate with a real OCR service.

## Validation Rules

- **Brand:** 85%+ similarity = ✅, 60-85% = ⚠️, <60% = ❌
- **Class/Type:** 85%+ similarity = ✅, 60-85% = ⚠️, <60% = ❌
- **ABV:** <0.1% difference = ✅, <1% = ⚠️, >1% = ❌
- **Net Contents:** Exact unit match + <5% difference = ✅
- **Government Warning:** Exact match (normalized) = ✅, 95%+ = ⚠️, <95% = ❌

## Build for Production

```bash
npm run build
npm start
```

## Contributing

This is a prototype application. For production use, consider:
- Integrating with real OCR services (Google Vision, AWS Textract, Azure Computer Vision)
- Adding authentication and user management
- Implementing persistent storage for results
- Adding more sophisticated image preprocessing
- Expanding validation rules and customization options

## License

ISC