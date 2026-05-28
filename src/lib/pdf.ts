import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBRL, formatDate } from "./format";

export type BudgetData = {
  number: number;
  created_at: string;
  client_name: string;
  client_company?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  delivery_time?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  total: number;
  items: { description: string; quantity: number; unit_price: number; total: number }[];
};

export type CompanyData = {
  company_name?: string | null;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
};

// Palette (matches HTML template)
const NAVY: [number, number, number] = [15, 23, 42];     // #0f172a
const BLUE: [number, number, number] = [29, 78, 216];    // #1d4ed8
const GRAY_BG: [number, number, number] = [249, 250, 251]; // #f9fafb
const GRAY_BORDER: [number, number, number] = [229, 231, 235]; // #e5e7eb
const TEXT: [number, number, number] = [31, 41, 55];     // #1f2937
const MUTED: [number, number, number] = [107, 114, 128]; // #6b7280

export async function generateBudgetPDF(budget: BudgetData, company: CompanyData, returnDoc?: boolean) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const innerW = pageW - margin * 2;

  // ===== Header (gradient simulated with two bands) =====
  const headerH = 40;
  // Base navy
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, headerH, "F");
  // Diagonal blue overlay (right side) to suggest gradient
  doc.setFillColor(...BLUE);
  doc.triangle(pageW * 0.35, 0, pageW, 0, pageW, headerH, "F");

  // Logo
  let logoOffset = 0;
  if (company.logo_url) {
    try {
      const url = new URL(company.logo_url);
      url.searchParams.set("t", Date.now().toString());
      
      const imgData = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } else {
            reject("No canvas context");
          }
        };
        img.onerror = reject;
        img.src = url.toString();
      });

      doc.addImage(imgData, "PNG", margin, 8, 24, 24);
      logoOffset = 28;
    } catch (err) {
      console.error("Failed to add logo to PDF:", err);
    }
  }

  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(company.company_name || "Empresa", margin + logoOffset, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const headerLines = [
    company.cnpj ? `CNPJ: ${company.cnpj}` : "",
    company.address || "",
    [company.phone, company.email].filter(Boolean).join(" • "),
  ].filter(Boolean);
  headerLines.forEach((l, i) => doc.text(l, margin + logoOffset, 22 + i * 4));

  // Right: ORÇAMENTO Nº + data
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("ORÇAMENTO", pageW - margin, 17, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${String(budget.number).padStart(6, "0")}`, pageW - margin, 25, { align: "right" });
  doc.text(`Data: ${formatDate(budget.created_at)}`, pageW - margin, 31, { align: "right" });

  // ===== Body =====
  let y = headerH + 12;

  // Section title helper
  const sectionTitle = (label: string, posY: number) => {
    doc.setFillColor(...BLUE);
    doc.rect(margin, posY - 4, 1.6, 6, "F"); // left bar
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, margin + 5, posY);
  };

  // ---- Dados do Cliente ----
  sectionTitle("Dados do Cliente", y);
  y += 5;

  const fields: { label: string; value: string }[] = [
    { label: "Cliente", value: budget.client_name || "—" },
    { label: "Empresa", value: budget.client_company || "—" },
    { label: "Telefone", value: budget.client_phone || "—" },
    { label: "E-mail", value: budget.client_email || "—" },
  ];

  const colW = (innerW - 6) / 2;
  const rowH = 16;
  fields.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (colW + 6);
    const by = y + row * (rowH + 4);
    doc.setFillColor(...GRAY_BG);
    doc.setDrawColor(...GRAY_BORDER);
    doc.roundedRect(x, by, colW, rowH, 2, 2, "FD");
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(f.label.toUpperCase(), x + 4, by + 5);
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(f.value, x + 4, by + 12);
  });
  y += Math.ceil(fields.length / 2) * (rowH + 4) + 6;

  // ---- Itens do Orçamento ----
  sectionTitle("Itens do Orçamento", y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Item", "Descrição", "Qtd", "Valor Unit.", "Total"]],
    body: budget.items.map((i, idx) => [
      String(idx + 1).padStart(2, "0"),
      i.description,
      String(i.quantity),
      formatBRL(i.unit_price),
      formatBRL(i.total),
    ]),
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 10, halign: "left" },
    bodyStyles: { fontSize: 9, textColor: TEXT, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "right", cellWidth: 34 },
    },
    margin: { left: margin, right: margin },
    theme: "plain",
    didDrawCell: (data) => {
      // bottom border on body rows
      if (data.section === "body") {
        const { x, y: cy, width, height } = data.cell;
        doc.setDrawColor(...GRAY_BORDER);
        doc.setLineWidth(0.1);
        doc.line(x, cy + height, x + width, cy + height);
      }
    },
  });

  let cursorY = (doc as any).lastAutoTable.finalY + 8;

  // ---- Total box (right) ----
  const totalW = 90;
  const totalH = 22;
  const totalX = pageW - margin - totalW;
  doc.setFillColor(...NAVY);
  doc.roundedRect(totalX, cursorY, totalW, totalH, 3, 3, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("VALOR TOTAL", totalX + 6, cursorY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(formatBRL(budget.total), totalX + totalW - 6, cursorY + 17, { align: "right" });
  cursorY += totalH + 10;

  // ---- Condições Comerciais ----
  if (budget.delivery_time || budget.payment_terms) {
    if (cursorY > pageH - 70) { doc.addPage(); cursorY = 20; }
    sectionTitle("Condições Comerciais", cursorY);
    cursorY += 5;

    const conds = [
      { label: "Prazo de Entrega", value: budget.delivery_time || "—" },
      { label: "Forma de Pagamento", value: budget.payment_terms || "—" },
    ];
    conds.forEach((f, i) => {
      const x = margin + i * (colW + 6);
      doc.setFillColor(...GRAY_BG);
      doc.setDrawColor(...GRAY_BORDER);
      doc.roundedRect(x, cursorY, colW, rowH, 2, 2, "FD");
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(f.label.toUpperCase(), x + 4, cursorY + 5);
      doc.setTextColor(...TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(f.value, x + 4, cursorY + 12);
    });
    cursorY += rowH + 8;
  }

  // ---- Observações ----
  if (budget.notes) {
    if (cursorY > pageH - 60) { doc.addPage(); cursorY = 20; }
    sectionTitle("Observações", cursorY);
    cursorY += 4;

    doc.setDrawColor(...MUTED);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setFillColor(...GRAY_BG);
    const notesLines = doc.splitTextToSize(budget.notes, innerW - 10);
    const boxH = Math.max(20, notesLines.length * 5 + 10);
    doc.roundedRect(margin, cursorY, innerW, boxH, 3, 3, "FD");
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(notesLines, margin + 5, cursorY + 7);
    cursorY += boxH + 4;
  }

  // ===== Footer (dark bar) =====
  const footerH = 14;
  doc.setFillColor(17, 24, 39); // #111827
  doc.rect(0, pageH - footerH, pageW, footerH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const footerText = [
    company.company_name || "Empresa",
    company.email,
    company.phone,
  ].filter(Boolean).join("  •  ");
  doc.text(footerText, pageW / 2, pageH - 5, { align: "center" });

  if (returnDoc) return doc;
  doc.save(`Orcamento-${String(budget.number).padStart(5, "0")}.pdf`);
}


