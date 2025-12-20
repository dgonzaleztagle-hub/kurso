import jsPDF from "jspdf";

interface PaymentData {
  folio: number;
  studentId?: number;
  studentName: string;
  paymentDate: string;
  amount: number;
  concept: string;
}

export const generatePaymentReceipt = (payment: PaymentData): void => {
  const doc = new jsPDF();
  
  // Configuración inicial
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  // Encabezado
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("COMPROBANTE DE PAGO", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Pre Kinder B - Colegio Santa Cruz", pageWidth / 2, 30, { align: "center" });
  
  // Número de folio
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`N° ${payment.folio}`, pageWidth - margin, 20, { align: "right" });
  
  // Línea divisoria
  doc.setLineWidth(0.5);
  doc.line(margin, 40, pageWidth - margin, 40);
  
  // Información del pago
  let yPos = 55;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  if (payment.studentId) {
    doc.text(`ID del Estudiante:`, margin, yPos);
    doc.setFont("helvetica", "bold");
    doc.text(`${payment.studentId}`, margin + 60, yPos);
    yPos += 10;
  }
  
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre del Estudiante:`, margin, yPos);
  doc.setFont("helvetica", "bold");
  doc.text(payment.studentName, margin + 60, yPos);
  yPos += 10;
  
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha del Pago:`, margin, yPos);
  doc.setFont("helvetica", "bold");
  doc.text(new Date(payment.paymentDate).toLocaleDateString("es-CL"), margin + 60, yPos);
  yPos += 10;
  
  doc.setFont("helvetica", "normal");
  doc.text(`Monto del Pago:`, margin, yPos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const formattedAmount = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(payment.amount);
  doc.text(formattedAmount, margin + 60, yPos);
  yPos += 12;
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Concepto:`, margin, yPos);
  doc.setFont("helvetica", "bold");
  doc.text(payment.concept, margin + 60, yPos);
  
  // Línea divisoria inferior
  yPos += 20;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  // Footer
  yPos += 15;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text(
    "Cualquier duda puede contactarme por WhatsApp +569-54031472",
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  
  // Firma
  yPos += 30;
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 5;
  doc.setFontSize(8);
  doc.text("Firma y Timbre", margin + 15, yPos);
  
  // Fecha de emisión
  doc.text(
    `Fecha de emisión: ${new Date().toLocaleDateString("es-CL")}`,
    pageWidth - margin,
    yPos,
    { align: "right" }
  );
  
  // Descargar el PDF
  const fileName = `Comprobante_${payment.folio}_${payment.studentName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
};