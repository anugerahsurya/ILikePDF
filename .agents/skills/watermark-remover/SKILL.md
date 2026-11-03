---
name: watermark-remover
description: Inspect and strip AI provenance watermarks, hidden Unicode markers (ZWSP, tags, homoglyphs), C2PA manifests, and visual/metadata watermarks from PDFs, documents, text, and images based on guillaumemeyer/watermarks-remover.
---

# Watermark Remover Skill

Privacy-first tool and workflow to inspect and strip multi-vendor AI provenance marks, invisible steganographic Unicode markers, metadata/C2PA manifests, and visual stamps from content you own.

Based on the architecture and rules of [guillaumemeyer/watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover).

## Capabilities

### 1. Layer A: Invisible Unicode & Steganography Stripper
Strips invisible characters and format controls commonly used for AI provenance tagging, model tracking, or steganography:
- **Zero-Width Characters:** `U+200B` (ZWSP), `U+200C` (ZWNJ), `U+200D` (ZWJ), `U+FEFF` (BOM/ZWNBSP).
- **Format & Bidi Controls:** `U+00AD` (Soft Hyphen), `U+034F` (CGJ), `U+061C` (ALM), `U+200E`/`U+200F` (LRM/RLM), `U+202A`–`U+202E` (Direction embeddings/overrides), `U+2060` (Word Joiner), `U+2066`–`U+2069` (Bidi isolates).
- **Stego Tag Characters:** `U+E0001` through `U+E007F` (Used in AI watermarking schemes).
- **Variation Selectors:** `U+FE00`–`U+FE0F` and `U+E0100`–`U+E01EF`.
- **Private Use Area (PUA):** `U+E000`–`U+F8FF`, `U+F0000`–`U+FFFFD`, `U+100000`–`U+10FFFD`.
- **Homoglyph Spaces:** Normalizes `U+00A0` (NBSP), `U+1680` (Ogham), `U+2000`–`U+200A` (En/Em/Thin/Hair spaces), `U+202F`, `U+205F`, `U+3000` to standard ASCII space (`U+0020`).

### 2. PDF & Document Metadata / Provenance Stripper
- **XMP Streams:** Drops document-level and page-level `/Metadata` XMP packets containing C2PA assertions, AI generator software tags, and prompt histories.
- **Info Dictionary:** Cleans `Author`, `Creator`, `Producer`, `CreationDate`, `ModDate`, `Title`, `Subject`, `Keywords`, and vendor keys (`AIGenerator`, `Claude`, `OpenAI`, `Gemini`, `SynthID`, `C2PA`).
- **Annotations:** Detects and strips `/Subtype /Watermark` and `/Subtype /Stamp` annotations.
- **PieceInfo:** Removes third-party private editor application caches from Catalog and Pages.
- **Visual Watermark Masking:** Covers visual stamps (diagonal text, headers, footers, center banners) with clean background matching patches.

### 3. Image Metadata Stripper
- Sanitizes raster images (PNG, JPEG, WebP) by re-encoding canvas pixel data, purging EXIF, XMP, GPS coordinates, and C2PA manifests.

## Usage in Web Application
The web app includes the user-friendly interface at route `/remove-watermark`:
1. Navigate to **Hapus Watermark** in the "Edit & keamanan" group.
2. Select your target:
   - **PDF & Dokumen:** Upload any PDF to inspect and purge metadata, C2PA, and visual watermarks.
   - **Teks & AI Stego:** Paste or upload text/markdown to scan and strip invisible steganography.
   - **Gambar (EXIF/C2PA):** Clean images in one click.
