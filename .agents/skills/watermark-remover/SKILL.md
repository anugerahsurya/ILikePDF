---
name: watermark-remover
description: Inspect and strip visual watermarks, Word (.docx/.doc) header/background watermarks, hidden Unicode markers (ZWSP, tags, homoglyphs), C2PA manifests, and metadata from PDFs, Word documents (.docx/.doc), text, and images.
---

# Watermark Remover Skill

Privacy-first tool and workflow to inspect and strip visual watermarks, Microsoft Word (`.docx`/`.doc`) VML/DrawingML/SDT watermarks, invisible steganographic Unicode markers, and metadata/C2PA manifests from content you own.

Based on the architecture and rules of [guillaumemeyer/watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover), extended with OpenXML `.docx` and `.doc` watermark cleaning.

## Capabilities

### 1. Microsoft Word (`.docx` & `.doc`) Watermark & Metadata Stripper
- **Visual Header/Footer Watermarks:** Detects and removes `<w:sdt>` Watermark gallery blocks, VML `<v:shape>` / `<w:pict>` text and picture watermarks (`PowerPlusWaterMarkObject`, `WordPictureWatermark`, `<v:textpath>`), and `<wp:anchor behindDoc="1">` background images across `word/header*.xml`, `word/footer*.xml`, and `word/document.xml`.
- **Page Background:** Removes `<w:background>` from `word/document.xml` and `<w:displayBackgroundShape/>` from `word/settings.xml`.
- **Document Metadata & Session Tracking:** Sanitizes `docProps/core.xml`, `docProps/app.xml`, `docProps/custom.xml`, and strips RSID revision tracking identifiers (`<w:rsids>` and `w:rsid*` attributes).
- **Legacy `.doc` Support:** Cleans RTF/VML/OLE `.doc` files and supports rebuilding legacy `.doc` files into clean `.docx` documents.

### 2. Layer A: Invisible Unicode & Steganography Stripper
Strips invisible characters and format controls:
- **Zero-Width Characters:** `U+200B` (ZWSP), `U+200C` (ZWNJ), `U+200D` (ZWJ), `U+FEFF` (BOM/ZWNBSP).
- **Format & Bidi Controls:** `U+00AD` (Soft Hyphen), `U+034F` (CGJ), `U+061C` (ALM), `U+200E`/`U+200F` (LRM/RLM), `U+202A`–`U+202E`, `U+2060`, `U+2066`–`U+2069`.
- **Stego Tag Characters:** `U+E0001` through `U+E007F`.
- **Variation Selectors & PUA:** `U+FE00`–`U+FE0F`, `U+E0100`–`U+E01EF`, `U+E000`–`U+F8FF`.
- **Homoglyph Spaces:** Normalizes `U+00A0` (NBSP), `U+1680`, `U+2000`–`U+200A`, `U+202F`, `U+205F`, `U+3000` to standard ASCII space (`U+0020`).

### 3. PDF Metadata & Visual Watermark Stripper
- **XMP Streams:** Drops document-level and page-level `/Metadata` XMP packets and C2PA manifests.
- **Info Dictionary:** Cleans `Author`, `Creator`, `Producer`, `CreationDate`, `ModDate`, `Title`, `Subject`, `Keywords`.
- **Annotations:** Detects and strips `/Subtype /Watermark` and `/Subtype /Stamp` annotations.
- **Visual Watermark Masking:** Covers visual stamps (diagonal, center, header, footer) with clean background patches.

### 4. Image Metadata Stripper
- Sanitizes raster images (PNG, JPEG, WebP) by re-encoding canvas pixel data, purging EXIF, XMP, GPS coordinates, and C2PA manifests.
