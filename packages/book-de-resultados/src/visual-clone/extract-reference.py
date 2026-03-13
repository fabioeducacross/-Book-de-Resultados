#!/usr/bin/env python3
"""
extract-reference.py — Visual Clone Experiment

Extracts a target page from the PDF institutional reference and saves it as a PNG
raster image at a specified DPI.

Usage:
    python extract-reference.py --pdf <path> --page <index> --out <dir> [--dpi N] [--filename name.png]

Arguments:
    --pdf       Path to the PDF reference file
    --page      Zero-based page index to extract (default: 0)
    --out       Output directory for the PNG
    --dpi       Rasterization DPI (default: 150)
    --filename  Output filename (default: reference-page.png)

The script:
    1. Opens the PDF with PyMuPDF (fitz)
    2. Rasterizes the target page at the specified DPI
    3. Saves the PNG to the output directory
    4. Emits a JSON metadata file alongside the PNG

Per Section 8.1 (step 4) and Section 9.4 of the experiment specification.

Dependencies:
    pip install PyMuPDF
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser(description='Extract PDF reference page as PNG')
    parser.add_argument('--pdf', required=True, help='Path to the PDF reference file')
    parser.add_argument('--page', type=int, default=0, help='Zero-based page index (default: 0)')
    parser.add_argument('--out', required=True, help='Output directory')
    parser.add_argument('--dpi', type=int, default=150, help='Rasterization DPI (default: 150)')
    parser.add_argument('--filename', default='reference-page.png', help='Output filename')
    return parser.parse_args()


def extract_reference_page(pdf_path, page_index, output_dir, dpi=150, filename='reference-page.png'):
    """
    Extracts a single page from a PDF and saves it as a PNG.

    Args:
        pdf_path (str): Path to the PDF file.
        page_index (int): Zero-based index of the page to extract.
        output_dir (str): Directory where output files will be saved.
        dpi (int): Rasterization DPI for the PNG output.
        filename (str): Name of the output PNG file.

    Returns:
        dict: Metadata about the extraction.

    Raises:
        ImportError: If PyMuPDF is not installed.
        FileNotFoundError: If the PDF file is not found.
        IndexError: If page_index is out of range.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print('ERROR: PyMuPDF is not installed. Run: pip install PyMuPDF', file=sys.stderr)
        sys.exit(1)

    pdf_path = os.path.abspath(pdf_path)
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f'PDF file not found: {pdf_path}')

    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    page_count = doc.page_count

    if page_index < 0 or page_index >= page_count:
        doc.close()
        raise IndexError(
            f'Page index {page_index} is out of range (document has {page_count} pages)'
        )

    page = doc[page_index]
    page_rect = page.rect

    # Scale matrix: 1 pt = 1/72 inch; target DPI = dpi px/inch
    # So scale = dpi / 72
    scale = dpi / 72.0
    mat = fitz.Matrix(scale, scale)

    # Render page to pixmap (RGB, no alpha for clean comparison)
    pix = page.get_pixmap(matrix=mat, alpha=False)

    png_path = os.path.join(output_dir, filename)
    pix.save(png_path)

    meta = {
        'extractedAt': datetime.now(timezone.utc).isoformat(),
        'pdfPath': pdf_path,
        'pageIndex': page_index,
        'pageCount': page_count,
        'dpi': dpi,
        'scale': scale,
        'pdfPageWidth_pt': page_rect.width,
        'pdfPageHeight_pt': page_rect.height,
        'outputWidth_px': pix.width,
        'outputHeight_px': pix.height,
        'pngPath': os.path.abspath(png_path),
    }

    meta_path = os.path.join(output_dir, filename.replace('.png', '.meta.json'))
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)

    doc.close()
    return meta


def main():
    args = parse_args()

    try:
        meta = extract_reference_page(
            pdf_path=args.pdf,
            page_index=args.page,
            output_dir=args.out,
            dpi=args.dpi,
            filename=args.filename,
        )
        print(f'Reference PNG saved: {meta["pngPath"]}')
        print(f'Dimensions: {meta["outputWidth_px"]}×{meta["outputHeight_px"]} px at {meta["dpi"]} DPI')
        print(f'Metadata saved alongside PNG')
    except (FileNotFoundError, IndexError) as err:
        print(f'ERROR: {err}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
