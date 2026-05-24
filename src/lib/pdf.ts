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

export async function generateBudgetPDF(budget: BudgetData, company: CompanyData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header brand bar
  doc.setFillColor(30, 41, 130);
  doc.rect(0, 0, pageW, 32, "F");

  // Logo
  if (company.logo_url) {
    try {
      const img = await fetch(company.logo_url).then((r) => r.blob()).then(blobToDataURL);
      doc.addImage(img, "PNG", margin, 6, 20, 20);
    } catch { /* skip */ }
  }

  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(company.company_name || "Empresa", margin + 24, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const headerLines = [
    company.cnpj ? `CNPJ: ${company.cnpj}` : "",
    company.address || "",
    [company.phone, company.email].filter(Boolean).join(" • "),
  ].filter(Boolean);
  headerLines.forEach((l, i) => doc.text(l, margin + 24, 20 + i * 4));

  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`ORÇAMENTO Nº ${String(budget.number).padStart(5, "0")}`, pageW - margin, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${formatDate(budget.created_at)}`, pageW - margin, 24, { align: "right" });

  // Client box
  doc.setTextColor(0);
  let y = 42;
  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y, pageW - margin * 2, 26, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${budget.client_name}`, margin + 4, y + 12);
  if (budget.client_company) doc.text(`Empresa: ${budget.client_company}`, margin + 4, y + 17);
  const contact = [budget.client_phone, budget.client_email].filter(Boolean).join(" • ");
  if (contact) doc.text(contact, margin + 4, y + 22);

  // Items table
  autoTable(doc, {
    startY: y + 32,
    head: [["Descrição", "Qtd.", "Valor unit.", "Total"]],
    body: budget.items.map((i) => [i.description, String(i.quantity), formatBRL(i.unit_price), formatBRL(i.total)]),
    headStyles: { fillColor: [30, 41, 130], textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Total
  doc.setFillColor(30, 41, 130);
  doc.rect(pageW - margin - 70, finalY, 70, 12, "F");
  doc.setTextColor(255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${formatBRL(budget.total)}`, pageW - margin - 4, finalY + 8, { align: "right" });

  // Footer info
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let fy = finalY + 22;
  if (budget.delivery_time) { doc.setFont("helvetica", "bold"); doc.text("Prazo de entrega:", margin, fy); doc.setFont("helvetica", "normal"); doc.text(budget.delivery_time, margin + 38, fy); fy += 5; }
  if (budget.payment_terms) { doc.setFont("helvetica", "bold"); doc.text("Forma de pagamento:", margin, fy); doc.setFont("helvetica", "normal"); doc.text(budget.payment_terms, margin + 42, fy); fy += 5; }
  if (budget.notes) {
    fy += 3;
    doc.setFont("helvetica", "bold"); doc.text("Observações:", margin, fy); fy += 5;
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(budget.notes, pageW - margin * 2);
    doc.text(split, margin, fy);
    fy += split.length * 5;
  }

  // Signature
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(180);
  doc.line(margin, pageH - 25, margin + 80, pageH - 25);
  doc.setFontSize(9);
  doc.text("Assinatura", margin, pageH - 20);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, pageW - margin, pageH - 10, { align: "right" });

  doc.save(`Orcamento-${String(budget.number).padStart(5, "0")}.pdf`);
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
