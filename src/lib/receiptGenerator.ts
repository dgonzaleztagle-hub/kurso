import jsPDF from "jspdf";
import logoImage from "@/assets/logo-colegio.png";

interface PaymentReceiptData {
  folio: number;
  studentId: number;
  studentName: string;
  paymentDate: string;
  amount: number;
  concept: string;
}

interface ExpenseReceiptData {
  folio: number;
  supplier: string;
  expenseDate: string;
  amount: number;
  concept: string;
}

interface TransferReceiptData {
  studentId: number;
  studentName: string;
  transferDate: string;
  amount: number;
  originalConcept: string;
  redirectType: 'credit' | 'debts';
  details?: Array<{
    concept: string;
    amount: number;
  }>;
  remainingCredit?: number;
}

export const generatePaymentReceipt = async (data: PaymentReceiptData) => {
  const doc = new jsPDF();
  
  // Load logo
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.src = logoImage;
    img.onload = () => resolve(img);
  });

  // Background color
  doc.setFillColor(240, 245, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // Header - Logo
  doc.addImage(logoImg, 'PNG', 85, 20, 40, 40);

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text(`COMPROBANTE DE PAGO N° ${data.folio}`, 105, 70, { align: "center" });

  // Subtitle
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Pre Kinder B - Colegio Santa Cruz", 105, 78, { align: "center" });

  // Content box
  const boxY = 95;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.roundedRect(30, boxY, 150, 80, 3, 3, 'FD');

  // Content
  let yPos = boxY + 15;
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  
  doc.setFont("helvetica", "bold");
  doc.text("ID del Estudiante:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.studentId.toString(), 95, yPos);
  
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Nombre del Estudiante:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.studentName, 95, yPos);
  
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Fecha del Pago:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(data.paymentDate).toLocaleDateString("es-CL"), 95, yPos);
  
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Monto del Pago:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(34, 197, 94);
  doc.text(`$ ${Number(data.amount).toLocaleString("es-CL")}`, 95, yPos);
  
  yPos += 12;
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.text("Asunto:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.concept, 95, yPos);

  // Contact info
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Cualquier duda puede contactarme por WhatsApp +569-54031472", 105, 195, { align: "center" });

  // Footer
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("COLEGIO SANTA CRUZ", 105, 270, { align: "center" });

  // Save
  const fileName = `Comprobante_de_Pago_${data.studentName.replace(/\s+/g, '_')}_${data.concept.replace(/\s+/g, '_')}_${new Date(data.paymentDate).toLocaleDateString("es-CL").replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
};

export const generateExpenseReceipt = async (data: ExpenseReceiptData) => {
  const doc = new jsPDF();
  
  // Load logo
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.src = logoImage;
    img.onload = () => resolve(img);
  });

  // Background color
  doc.setFillColor(255, 245, 240);
  doc.rect(0, 0, 210, 297, 'F');

  // Date stamp (top left)
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(new Date().toLocaleDateString("es-CL"), 20, 20);

  // Header - Logo
  doc.addImage(logoImg, 'PNG', 85, 30, 40, 40);

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(185, 28, 28);
  doc.text(`Comprobante de Salida de Dinero N° ${data.folio}`, 105, 80, { align: "center" });

  // Subtitle
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Pre kínder B - Colegio Santa Cruz", 105, 88, { align: "center" });

  // Content box
  const boxY = 105;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.5);
  doc.roundedRect(30, boxY, 150, 70, 3, 3, 'FD');

  // Content
  let yPos = boxY + 15;
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  
  doc.setFont("helvetica", "bold");
  doc.text("Destinatario:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.supplier, 95, yPos);
  
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(data.expenseDate).toLocaleDateString("es-CL"), 95, yPos);
  
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Monto:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(185, 28, 28);
  doc.text(`-$${Number(data.amount).toLocaleString("es-CL")}`, 95, yPos);
  
  yPos += 12;
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.text("Asunto:", 40, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.concept, 95, yPos);

  // Footer
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(185, 28, 28);
  doc.text("COLEGIO", 105, 255, { align: "center" });
  doc.text("SANTA CRUZ", 105, 265, { align: "center" });

  // Save
  const fileName = `Comprobante_Salida_${data.folio}.pdf`;
  doc.save(fileName);
};

export const generateTransferReceipt = async (data: TransferReceiptData) => {
  const doc = new jsPDF();
  
  // Load logo
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.src = logoImage;
    img.onload = () => resolve(img);
  });

  // Background color
  doc.setFillColor(250, 245, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // Header - Logo
  doc.addImage(logoImg, 'PNG', 85, 20, 40, 40);

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(126, 34, 206);
  doc.text("COMPROBANTE DE TRASPASO", 105, 70, { align: "center" });

  // Subtitle
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Pre Kinder B - Colegio Santa Cruz", 105, 78, { align: "center" });

  // Date stamp
  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date(data.transferDate).toLocaleDateString("es-CL")}`, 105, 86, { align: "center" });

  // Content box
  const boxY = 100;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(147, 51, 234);
  doc.setLineWidth(0.5);
  doc.roundedRect(20, boxY, 170, 90, 3, 3, 'FD');

  // Content
  let yPos = boxY + 15;
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  
  doc.setFont("helvetica", "bold");
  doc.text("ID del Estudiante:", 30, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.studentId.toString(), 90, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Nombre del Estudiante:", 30, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.studentName, 90, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Concepto Original:", 30, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.originalConcept, 90, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Monto Traspasado:", 30, yPos);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(126, 34, 206);
  doc.text(`$ ${Number(data.amount).toLocaleString("es-CL")}`, 90, yPos);
  
  yPos += 10;
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.text("Tipo de Traspaso:", 30, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.redirectType === 'credit' ? 'Saldo a Favor' : 'Aplicado a Deudas', 90, yPos);

  // Details section if redirected to debts
  if (data.redirectType === 'debts' && data.details && data.details.length > 0) {
    yPos += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Detalle de Aplicación:", 30, yPos);
    
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    for (const detail of data.details) {
      if (yPos > 175) break;
      doc.text(`• ${detail.concept}`, 35, yPos);
      doc.text(`$ ${Number(detail.amount).toLocaleString("es-CL")}`, 170, yPos, { align: "right" });
      yPos += 6;
    }
    
    if (data.remainingCredit && data.remainingCredit > 0) {
      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text("Saldo a Favor Restante:", 35, yPos);
      doc.text(`$ ${Number(data.remainingCredit).toLocaleString("es-CL")}`, 170, yPos, { align: "right" });
    }
  }

  // Info box
  doc.setFillColor(243, 232, 255);
  doc.setDrawColor(147, 51, 234);
  doc.roundedRect(20, 200, 170, 25, 3, 3, 'FD');
  
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Este comprobante certifica el traspaso interno de fondos.", 105, 210, { align: "center" });
  doc.text("No representa un ingreso o egreso bancario.", 105, 217, { align: "center" });

  // Contact info
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Cualquier duda puede contactarme por WhatsApp +569-54031472", 105, 245, { align: "center" });

  // Footer
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(126, 34, 206);
  doc.text("COLEGIO SANTA CRUZ", 105, 270, { align: "center" });

  // Save
  const fileName = `Comprobante_Traspaso_${data.studentName.replace(/\s+/g, '_')}_${new Date(data.transferDate).toLocaleDateString("es-CL").replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
};

interface PendingFormReportData {
  formTitle: string;
  pendingStudents: { name: string }[];
  excludedStudents: { name: string; reason?: string }[];
  totalStudents: number;
  respondedCount: number;
}

export const generatePendingFormReport = async (data: PendingFormReportData) => {
  const doc = new jsPDF();
  
  // Load logo
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.src = logoImage;
    img.onload = () => resolve(img);
  });

  // Background color
  doc.setFillColor(250, 252, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // Header - Logo
  doc.addImage(logoImg, 'PNG', 85, 15, 40, 40);

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("INFORME DE RESPUESTAS PENDIENTES", 105, 65, { align: "center" });

  // Form title
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(data.formTitle, 105, 73, { align: "center" });

  // Statistics box
  const statsY = 85;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.3);
  doc.roundedRect(20, statsY, 170, 25, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  
  // Stats columns
  const colWidth = 42.5;
  const cols = [
    { label: "Total", value: data.totalStudents.toString(), color: [71, 85, 105] },
    { label: "Respondieron", value: data.respondedCount.toString(), color: [34, 197, 94] },
    { label: "Pendientes", value: data.pendingStudents.length.toString(), color: [234, 179, 8] },
    { label: "Excluidos", value: data.excludedStudents.length.toString(), color: [107, 114, 128] }
  ];
  
  cols.forEach((col, i) => {
    const x = 20 + (i * colWidth) + (colWidth / 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(col.color[0], col.color[1], col.color[2]);
    doc.text(col.value, x, statsY + 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.text(col.label, x, statsY + 18, { align: "center" });
    doc.setFontSize(9);
  });

  let yPos = statsY + 35;

  // Pending students list
  if (data.pendingStudents.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(234, 179, 8);
    doc.text("Estudiantes Pendientes", 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);

    data.pendingStudents.forEach((student, i) => {
      if (yPos > 270) {
        doc.addPage();
        doc.setFillColor(250, 252, 255);
        doc.rect(0, 0, 210, 297, 'F');
        yPos = 20;
      }
      doc.text(`${i + 1}. ${student.name}`, 25, yPos);
      yPos += 6;
    });
  }

  // Excluded students list
  if (data.excludedStudents.length > 0) {
    yPos += 10;
    
    if (yPos > 250) {
      doc.addPage();
      doc.setFillColor(250, 252, 255);
      doc.rect(0, 0, 210, 297, 'F');
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 114, 128);
    doc.text("Estudiantes Excluidos", 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);

    data.excludedStudents.forEach((student, i) => {
      if (yPos > 270) {
        doc.addPage();
        doc.setFillColor(250, 252, 255);
        doc.rect(0, 0, 210, 297, 'F');
        yPos = 20;
      }
      const reasonText = student.reason ? ` - ${student.reason}` : '';
      doc.text(`${i + 1}. ${student.name}${reasonText}`, 25, yPos);
      yPos += 6;
    });
  }

  // Footer with date
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, 105, 285, { align: "center" });
    doc.text(`Página ${i} de ${pageCount}`, 190, 285, { align: "right" });
  }

  // Save
  const fileName = `Pendientes_${data.formTitle.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};
