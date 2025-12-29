# AI Alcohol Label Verification

An intelligent Next.js 14 application that uses Azure OpenAI to extract and verify alcohol label information against TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance standards. The system supports both single-label verification and batch processing with CSV import.

## Overview

This application automates the verification of alcohol labels by:
1. **Extracting** text and formatting from label images using Azure OpenAI's vision capabilities
2. **Comparing** extracted data against expected/reference data
3. **Evaluating** compliance across multiple fields with intelligent fuzzy matching
4. **Reporting** detailed verification results with pass/warning/fail statuses

## Features

### 🔍 Comprehensive Field Validation

The system validates these critical label fields:

- **Brand Name** - Fuzzy matching with normalization for punctuation and case variations
- **Class/Type** - Product classification (e.g., Whiskey, Vodka, Wine, Beer)
- **Alcohol Content (ABV)** - Numeric verification with tolerance ranges
- **Net Contents** - Volume verification with unit standardization
- **Government Warning** - Compliance check for required health statements with format validation (bold, all-caps)
- **Bottler/Producer** - Full name and address verification
- **Country of Origin** - Required for imported products
- **Additives Disclosure** - Detection of sulfites, aspartame, FD&C Yellow No. 5, cochineal extract, and carmine

### 📊 Processing Modes

1. **Single Label Verification**
   - Upload one image and manually enter expected data
   - Ideal for real-time label evaluation and testing
   - Immediate detailed results

2. **Batch Processing**
   - Upload multiple images with a CSV/Excel file containing expected data
   - Automated matching by filename
   - Parallel processing for efficiency (configurable concurrency)
   - Bulk status dashboard

### 🎯 Intelligent Evaluation

- **Multi-pass extraction** - Runs three parallel extraction attempts to reduce AI variance
- **Smart merging** - Automatically selects best results from multiple extraction attempts
- **Fuzzy matching** - Uses Levenshtein distance for brand and class comparisons
- **Heuristic overrides** - Additional validation rules for edge cases
- **Detailed scoring** - Field-by-field accuracy assessment

### 💡 User Experience

- Clean, accessible UI with ARIA attributes
- Real-time progress indicators for batch processing
- Responsive design with Tailwind CSS
- Dark mode support
- Side-by-side comparison view
- Status indicators: ✅ Pass / ⚠️ Warning / ❌ Fail

## Technology Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Azure OpenAI** - Vision and language models for extraction and evaluation
- **Azure Blob Storage** - Optional cloud storage for images (can work without)
- **Tailwind CSS** - Utility-first styling
- **Zod** - Runtime schema validation
- **Sharp** - Image processing and optimization

## Prerequisites

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Azure OpenAI Service** with a vision-capable deployment (e.g., GPT-4o, GPT-4 Turbo with Vision)
- **Azure Blob Storage** (optional, for cloud storage features)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Dundric/AI-Alcohol-Label-Verification.git
cd AI-Alcohol-Label-Verification
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following required variables:

```bash
# Azure OpenAI Configuration (REQUIRED)
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT=your-deployment-name-1
AZURE_OPENAI_DEPLOYMENTS=your-deployment-name-1,your-deployment-name-2

My AZURE_OPENAI_DEPLOYMENTS=gpt-4.1-mini,gpt-4.1,gpt-5-mini

```

#### How to Get Azure OpenAI Credentials:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign up for an Azure Account
2. Select **Foundry** service
3. Click **Create a Foundry Resource**
4. Follow steps to create **Endpoint** and one of the **Keys**
5. Go to **Model deployments** and deploy at least GPT 4.1-mini note your **deployment name**


### 4. Run Development Server

```bash
npm run dev
```

The application will start at [http://localhost:3000](http://localhost:3000)

### 5. Run Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Usage Guide

### Single Label Verification

1. **Navigate** to the home page at `http://localhost:3000`
2. Click **"Start Uploading →"** or go to `/upload`
3. Ensure **"Single"** mode is selected
4. **Upload** your label image (JPEG, PNG, WebP, GIF, BMP, or TIFF)
   - Note: Combine front, back, and side panels into one image if needed
5. **Fill in the Expected Data form** with the reference information
6. Click **"Process & Verify Labels"**
7. **Review Results** on the `/review` page with detailed field comparisons

### Batch Processing with CSV

1. Go to `/upload` and select **"Batch"** mode
2. **Upload Images:**
   - Click "Choose Images" and select multiple files, OR
   - Click "Choose Folder" to upload an entire directory (Chrome/Edge only)
3. **Upload CSV/Excel File:**
   - Use the provided template format (download from home page)
   - **Important:** The `image_name` column must exactly match your image filenames
   - Example CSV columns:
      ```
      image_name,brand_name,class_type,alcohol_content,net_contents,bottler_producer,
      product_type,country_of_origin,age_years,is_imported,
      beer_has_added_flavors_with_alcohol,additive_fdc_yellow_no_5,
      additive_cochineal_extract,additive_carmine,additive_aspartame,
      additive_sulfites_ge_10ppm
      ```
4. Click **"Process & Verify Labels"**
5. View bulk results dashboard with pass/fail/warning counts
6. Click individual images to see detailed comparisons

### CSV File Format

Your CSV must include these columns (see `/Table-Example.csv` for reference):

- `image_name` - Filename (e.g., "Fireball.jpg")
- `brand_name` - Brand name (e.g., "Fireball")
- `class_type` - Product type (e.g., "Cinnamon Whisky")
- `alcohol_content` - ABV percentage (e.g., "33%")
- `net_contents` - Volume (e.g., "100 ML")
- `bottler_producer` - Full name and address
- `product_type` - Product category (beer/wine/whiskey/rum/other_spirits)
- `country_of_origin` - Origin country (if imported)
- `age_years` - Age statement (if applicable)
- `is_imported` - TRUE/FALSE
- `beer_has_added_flavors_with_alcohol` - TRUE/FALSE
- `additive_*` columns - TRUE/FALSE for various additives

## Project Structure

```
/app
  /api
    /extract-label       # API endpoint for label extraction
      route.ts           # Next.js API route handler
  /upload                # Upload page with forms and logic
    page.tsx             # Main upload page component
    /components          # Upload UI components
    /hooks               # Custom React hooks
  /review                # Review/results page
    page.tsx             # Results comparison view
    /components          # review UI components
  layout.tsx             # Root layout with navigation
  page.tsx               # Home page with instructions
  globals.css            # Global styles and Tailwind imports

/lib
  /extraction            # Core extraction engine
    engine.ts            # Multi-pass extraction/eval
    prompts.ts           # AI prompts for extraction
    image-service.ts     # Image processing and encoding
    merger.ts            # Candidate result merging logic
    heuristics.ts        # Validation rules and overrides
    types.ts             # TypeScript type definitions
    utils.ts             # Helper functions
  schemas.ts             # Zod validation schemas
  compare.ts             # Comparison logic and fuzzy matching
  textSimilarity.ts      # String similarity algorithms
  ocr.ts                 # Client-side OCR interface

/public
  Fireball.jpg           # Example label image
  Table-Example.csv      # Example CSV template
```


## Troubleshooting

### "Missing Azure OpenAI configuration" Error

- Ensure `.env.local` exists with all three Azure OpenAI variables
- Restart the dev server after adding environment variables
- Verify your endpoint URL format: `https://YOUR-RESOURCE.openai.azure.com`

### Images Not Processing

- Check that your Azure OpenAI deployment supports vision (GPT-4o or GPT-4 Turbo with Vision)
- Verify API key has proper permissions
- Check image file size (max 10MB per file)
- Ensure image format is JPEG, PNG, WebP, GIF, BMP, or TIFF

### CSV Upload Issues

- Verify the `image_name` column exactly matches your filenames (including extensions)
- Check CSV encoding (UTF-8 recommended)
- Ensure all required columns are present
- Use boolean values: TRUE/FALSE (case-insensitive)

### Slow Batch Processing

- Azure OpenAI API has rate limits - adjust `CSV_PARALLEL_LIMIT` in `/lib/upload/constants.ts`
- Default is 5 concurrent requests; reduce if hitting rate limits
- Large batches will take time due to AI processing

## Deployment

### Deploy to Azure Static Web Apps

This repository includes a GitHub Actions workflow for Azure deployment:

1. Create an Azure Static Web App
2. Configure the GitHub integration
3. Set environment variables in Azure portal under Configuration
4. Push to your repository - automatic deployment via GitHub Actions

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
```

## Development

### Running Tests

Currently no automated tests are included. Manual testing is recommended for:
- Single image processing
- Batch CSV processing
- Various image formats and sizes
- Edge cases in field matching

### Adding New Validation Fields

1. Update schemas in `/lib/schemas.ts`
2. Modify extraction prompts in `/lib/extraction/prompts.ts`
3. Add comparison logic in `/lib/compare.ts`
4. Update UI forms in `/app/upload/components`

## Security Considerations

- Never commit `.env.local` to version control
- Rotate API keys regularly
- Use Azure RBAC for fine-grained access control
- Implement rate limiting for production deployments
- Sanitize user inputs (application uses Zod validation)
- Consider adding authentication for production use

## Performance Tips

- Images are automatically compressed and optimized
- Batch processing uses configurable parallelism to respect rate limits
- Azure OpenAI responses are streamed when possible
- Consider caching results for repeated verifications

## Future Enhancements

This is an actively developed application. Potential improvements:

- [ ] Add database persistence for verification history
- [ ] Implement user authentication and multi-tenancy
- [ ] Export results to PDF reports
- [ ] Add custom validation rule configuration
- [ ] Support for additional languages
- [ ] Training mode to improve extraction accuracy
- [ ] Integration with TTB COLA APIs
- [ ] Automated image quality checking
- [ ] Support for video label extraction

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Test thoroughly
5. Submit a pull request

## License

ISC

## Support

For issues, questions, or contributions:
- Open an issue on [GitHub](https://github.com/Dundric/AI-Alcohol-Label-Verification/issues)
- Review the troubleshooting section above
- Check Azure OpenAI documentation for API-related questions
