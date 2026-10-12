import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export async function exportReportToPDF(containerElementId: string, title = 'UF_TMP_Summary_Report'): Promise<void> {
  const element = document.getElementById(containerElementId);
  if (!element) {
    throw new Error('ไม่พบส่วนที่ต้องการส่งออก PDF');
  }

  // Create high-res canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = 210; // A4 mm
  const pdfHeight = 297; // A4 mm
  const margin = 10;
  const contentWidth = pdfWidth - margin * 2;
  const contentHeight = (canvas.height * contentWidth) / canvas.width;

  let heightLeft = contentHeight;
  let position = margin;

  // First page
  pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
  heightLeft -= (pdfHeight - margin * 2);

  // Subsequent pages if long
  while (heightLeft > 0) {
    position = heightLeft - contentHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
    heightLeft -= (pdfHeight - margin * 2);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  pdf.save(`${title}_${dateStr}.pdf`);
}
