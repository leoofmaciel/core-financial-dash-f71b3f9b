export const RM_PARTNERS = [
  { name: "Moisés", share_percent: 50, position: 0 },
  { name: "Paulo", share_percent: 50, position: 1 },
];

type Item = { description: string; amount: number; status: string; payments: Record<string, number> };

export const RM_INVESTMENTS: Item[] = [
  { description: "Torno", amount: 57000, status: "ok", payments: { "Moisés": 28500, "Paulo": 28500 } },
  { description: "Fresadora", amount: 45000, status: "ok", payments: { "Moisés": 25000, "Paulo": 20000 } },
  { description: "Esmeril / Coluna", amount: 575, status: "ok", payments: { "Moisés": 575 } },
  { description: "Instalação elétrica - material", amount: 960, status: "ok", payments: { "Paulo": 960 } },
  { description: "Instalação elétrica - mão de obra", amount: 950, status: "ok", payments: { "Moisés": 950 } },
  { description: "Transporte torno", amount: 1500, status: "ok", payments: { "Moisés": 750, "Paulo": 750 } },
  { description: "Pintura torno", amount: 500, status: "ok", payments: { "Paulo": 500 } },
  { description: "Pintura fresadora", amount: 500, status: "ok", payments: { "Moisés": 500 } },
  { description: "Iluminação / prolongador", amount: 940, status: "ok", payments: { "Moisés": 880, "Paulo": 60 } },
  { description: "Apalpador", amount: 299, status: "ok", payments: { "Moisés": 299 } },
  { description: "Paquímetro 200", amount: 384, status: "ok", payments: { "Moisés": 384 } },
  { description: "Morsa furadeira", amount: 265, status: "ok", payments: { "Moisés": 265 } },
  { description: "Banca", amount: 4366, status: "ok", payments: { "Moisés": 4366 } },
  { description: "Pente rosca", amount: 63, status: "ok", payments: { "Moisés": 63 } },
  { description: "Relógio comparador / base mag", amount: 429, status: "ok", payments: { "Moisés": 429 } },
  { description: "Tinta / acessórios", amount: 230, status: "ok", payments: { "Paulo": 230 } },
  { description: "ART porta", amount: 900, status: "ok", payments: { "Moisés": 900 } },
  { description: "Porta grade", amount: 1000, status: "ok", payments: { "Moisés": 1000 } },
  { description: "Ferramentas torno / fresa", amount: 3815, status: "ok", payments: { "Moisés": 3815 } },
  { description: "Súbito", amount: 1500, status: "ok", payments: { "Moisés": 1500 } },
  { description: "Morsa", amount: 1700, status: "ok", payments: { "Moisés": 1700 } },
  { description: "Transporte fresadora", amount: 900, status: "ok", payments: { "Paulo": 900 } },
  { description: "Borracha tapete", amount: 373, status: "ok", payments: { "Moisés": 373 } },
  { description: "Cartões de visita", amount: 95, status: "ok", payments: { "Moisés": 95 } },
  { description: "Kit parafusos", amount: 59, status: "ok", payments: { "Moisés": 59 } },
  { description: "Saca polia", amount: 138, status: "ok", payments: { "Moisés": 138 } },
  { description: "Mandril / ponto rotativo", amount: 278, status: "ok", payments: { "Moisés": 278 } },
  { description: "Jogo de machos", amount: 997, status: "ok", payments: { "Moisés": 997 } },
  { description: "Óleo de corte", amount: 74, status: "ok", payments: { "Moisés": 74 } },
  { description: "Jogo de brocas", amount: 172, status: "ok", payments: { "Moisés": 172 } },
  { description: "Almotolia", amount: 29, status: "ok", payments: { "Moisés": 29 } },
  { description: "Boleto PPCI", amount: 1000, status: "pendente", payments: { "Moisés": 1000 } },
  { description: "Instalação elétrica (diversos)", amount: 400, status: "ok", payments: { "Paulo": 400 } },
  { description: "Plaina", amount: 6500, status: "pendente", payments: { "Moisés": 6500 } },
  { description: "Furadeira", amount: 0, status: "pendente", payments: {} },
  { description: "Solda", amount: 0, status: "pendente", payments: {} },
  { description: "Prensa", amount: 0, status: "pendente", payments: {} },
  { description: "Compressor", amount: 0, status: "pendente", payments: {} },
  { description: "Aços", amount: 700, status: "ok", payments: { "Moisés": 700 } },
];

export const RM_RECURRENCES = [
  { name: "Aluguel", amount: 1000 },
  { name: "Água", amount: 50 },
  { name: "Luz", amount: 200 },
  { name: "Contador", amount: 400 },
];

export const RM_TASKS = [
  "Abrir conta bancária conjunta",
  "Capital de giro - conta banco",
  "Compra de materiais (aços)",
];
