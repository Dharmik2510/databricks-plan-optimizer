
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import LZString from 'lz-string';
import { AnalysisResult } from '../../shared/types';

export const exportService = {
    /**
     * Export analysis result to a JSON file
     */
    exportToJSON: (data: AnalysisResult, filename: string = 'analysis-report.json') => {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    },

    /**
     * Export the current dashboard view to a PDF report
     */
    exportToPDF: async (elementId: string, title: string = 'Optimization Report') => {
        const element = document.getElementById(elementId);
        if (!element) throw new Error('Element not found');

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    },

    /**
     * Generate a shareable link using LZ-String compression
     */
    generateShareLink: (data: AnalysisResult): string => {
        // We only compress essential data to keep the URL length manageable
        // For very large plans, this might strict still be too long, but it's a good client-side solution.
        // Ideally, we would persist to a backend.
        const minimalData = {
            summary: data.summary,
            optimizations: data.optimizations,
            // Omit large DAG structures for URL sharing if possible, or verify length
            // For now, we compress everything but might hit URL limits if > 2KB
            // Let's try to compress essential parts only if needed.
        };

        // For full state sharing, we need the whole object.
        const jsonString = JSON.stringify(data);
        const compressed = LZString.compressToEncodedURIComponent(jsonString);
        const url = new URL(window.location.href);
        url.searchParams.set('share', compressed);
        return url.toString();
    },

    /**
     * Decompress data from a share link
     */
    loadFromShareLink: (compressed: string): AnalysisResult | null => {
        try {
            const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
            if (!decompressed) return null;
            return JSON.parse(decompressed) as AnalysisResult;
        } catch (e) {
            console.error("Failed to parse share link", e);
            return null;
        }
    }
};
