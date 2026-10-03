import { getExpenseCategory } from "../../domain/expense-categories";
import type { Expense, LedgerSnapshot, RacetrackId } from "../../domain/types";

export const PREVIEW_AGENCY_ID = "agencia-dolores";
export const PREVIEW_AGENCY_NAME = "Agencia Dolores";
export const PREVIEW_MONTH = "2026-08";

type SaleSeed = {
  id: string;
  racetrackId: RacetrackId;
  date: string;
  soldCents: number;
  cancelledCents: number;
  paidCents: number;
};

type DepositSeed = {
  id: string;
  racetrackId: RacetrackId;
  date: string;
  amountCents: number;
};

const sales: SaleSeed[] = [
  { id: "sale-2026-08-01-palermo", racetrackId: "palermo", date: "2026-08-01", soldCents: 547864500, cancelledCents: 1104500, paidCents: 166719000 },
  { id: "sale-2026-08-02-san-isidro", racetrackId: "san-isidro", date: "2026-08-02", soldCents: 307384000, cancelledCents: 7560000, paidCents: 224704250 },
  { id: "sale-2026-08-03-palermo", racetrackId: "palermo", date: "2026-08-03", soldCents: 185882000, cancelledCents: 14000000, paidCents: 32590100 },
  { id: "sale-2026-08-04-la-plata", racetrackId: "la-plata", date: "2026-08-04", soldCents: 87783100, cancelledCents: 38900000, paidCents: 34962500 },
  { id: "sale-2026-08-05-san-isidro", racetrackId: "san-isidro", date: "2026-08-05", soldCents: 236093000, cancelledCents: 45000, paidCents: 259117225 },
  { id: "sale-2026-08-06-la-plata", racetrackId: "la-plata", date: "2026-08-06", soldCents: 165202500, cancelledCents: 0, paidCents: 38340000 },
  { id: "sale-2026-08-07-palermo", racetrackId: "palermo", date: "2026-08-07", soldCents: 509952500, cancelledCents: 800000, paidCents: 358919250 },
  { id: "sale-2026-08-08-san-isidro", racetrackId: "san-isidro", date: "2026-08-08", soldCents: 411669000, cancelledCents: 2000000, paidCents: 152180000 },
  { id: "sale-2026-08-09-la-plata", racetrackId: "la-plata", date: "2026-08-09", soldCents: 112697000, cancelledCents: 4000000, paidCents: 61107000 },
  { id: "sale-2026-08-10-palermo", racetrackId: "palermo", date: "2026-08-10", soldCents: 92102000, cancelledCents: 2000000, paidCents: 76621000 },
  { id: "sale-2026-08-11-la-plata", racetrackId: "la-plata", date: "2026-08-11", soldCents: 52317000, cancelledCents: 0, paidCents: 25248250 },
  { id: "sale-2026-08-12-san-isidro", racetrackId: "san-isidro", date: "2026-08-12", soldCents: 235623000, cancelledCents: 800000, paidCents: 156445475 },
  { id: "sale-2026-08-13-la-plata", racetrackId: "la-plata", date: "2026-08-13", soldCents: 186229500, cancelledCents: 14400000, paidCents: 12337500 },
  { id: "sale-2026-08-14-san-isidro", racetrackId: "san-isidro", date: "2026-08-14", soldCents: 137423500, cancelledCents: 800000, paidCents: 85650000 },
  { id: "sale-2026-08-15-la-plata", racetrackId: "la-plata", date: "2026-08-15", soldCents: 157357000, cancelledCents: 12200000, paidCents: 67975000 },
  { id: "sale-2026-08-17-palermo", racetrackId: "palermo", date: "2026-08-17", soldCents: 227210000, cancelledCents: 499500, paidCents: 52975000 },
  { id: "sale-2026-08-18-la-plata", racetrackId: "la-plata", date: "2026-08-18", soldCents: 28327000, cancelledCents: 0, paidCents: 16801700 },
  { id: "sale-2026-08-19-san-isidro", racetrackId: "san-isidro", date: "2026-08-19", soldCents: 158610000, cancelledCents: 200000, paidCents: 7890000 },
  { id: "sale-2026-08-20-palermo", racetrackId: "palermo", date: "2026-08-20", soldCents: 126270000, cancelledCents: 100000, paidCents: 7835000 },
  { id: "sale-2026-08-21-san-isidro", racetrackId: "san-isidro", date: "2026-08-21", soldCents: 271852000, cancelledCents: 10520000, paidCents: 246933000 },
  { id: "sale-2026-08-22-palermo", racetrackId: "palermo", date: "2026-08-22", soldCents: 359950000, cancelledCents: 3600000, paidCents: 298580000 },
  { id: "sale-2026-08-23-la-plata", racetrackId: "la-plata", date: "2026-08-23", soldCents: 75216300, cancelledCents: 2050300, paidCents: 38681500 },
  { id: "sale-2026-08-24-palermo", racetrackId: "palermo", date: "2026-08-24", soldCents: 252358500, cancelledCents: 0, paidCents: 292770000 },
  { id: "sale-2026-08-25-la-plata", racetrackId: "la-plata", date: "2026-08-25", soldCents: 175910000, cancelledCents: 16190000, paidCents: 11170000 },
  { id: "sale-2026-08-26-san-isidro", racetrackId: "san-isidro", date: "2026-08-26", soldCents: 326944100, cancelledCents: 200000, paidCents: 107623395 },
  { id: "sale-2026-08-27-la-plata", racetrackId: "la-plata", date: "2026-08-27", soldCents: 35312500, cancelledCents: 600000, paidCents: 14672500 },
  { id: "sale-2026-08-28-palermo", racetrackId: "palermo", date: "2026-08-28", soldCents: 224730000, cancelledCents: 0, paidCents: 93412000 },
  { id: "sale-2026-08-29-san-isidro", racetrackId: "san-isidro", date: "2026-08-29", soldCents: 484364000, cancelledCents: 15800000, paidCents: 480085000 },
  { id: "sale-2026-08-30-san-isidro", racetrackId: "san-isidro", date: "2026-08-30", soldCents: 234559200, cancelledCents: 400200, paidCents: 24463800 },
  { id: "sale-2026-08-31-palermo", racetrackId: "palermo", date: "2026-08-31", soldCents: 175000000, cancelledCents: 600000, paidCents: 51580000 },
];

const deposits: DepositSeed[] = [
  { id: "deposit-2026-08-03-la-plata-0", racetrackId: "la-plata", date: "2026-08-03", amountCents: 50000000 },
  { id: "deposit-2026-08-04-san-isidro-1", racetrackId: "san-isidro", date: "2026-08-04", amountCents: 70000000 },
  { id: "deposit-2026-08-07-la-plata-2", racetrackId: "la-plata", date: "2026-08-07", amountCents: 150000000 },
  { id: "deposit-2026-08-09-palermo-3", racetrackId: "palermo", date: "2026-08-09", amountCents: 150000000 },
  { id: "deposit-2026-08-13-san-isidro-4", racetrackId: "san-isidro", date: "2026-08-13", amountCents: 240000000 },
  { id: "deposit-2026-08-18-palermo-5", racetrackId: "palermo", date: "2026-08-18", amountCents: 170000000 },
  { id: "deposit-2026-08-19-la-plata-6", racetrackId: "la-plata", date: "2026-08-19", amountCents: 190000000 },
  { id: "deposit-2026-08-20-san-isidro-7", racetrackId: "san-isidro", date: "2026-08-20", amountCents: 160000000 },
  { id: "deposit-2026-08-21-palermo-8", racetrackId: "palermo", date: "2026-08-21", amountCents: 180000000 },
  { id: "deposit-2026-08-26-la-plata-9", racetrackId: "la-plata", date: "2026-08-26", amountCents: 150000000 },
  { id: "deposit-2026-08-28-san-isidro-10", racetrackId: "san-isidro", date: "2026-08-28", amountCents: 190000000 },
  { id: "deposit-2026-08-31-la-plata-11", racetrackId: "la-plata", date: "2026-08-31", amountCents: 100000000 },
];

const openingBalances: { racetrackId: RacetrackId; amountCents: number }[] = [
  { racetrackId: "palermo", amountCents: -373784900 },
  { racetrackId: "la-plata", amountCents: 144348100 },
  { racetrackId: "san-isidro", amountCents: 77589240 },
];

const expenseSeeds = [
  { id: "expense-sueldo", categoryId: "sueldo", detail: "Sueldo/Adelanto", amountCents: 60_000_000, paidOn: "2026-09-04" },
  { id: "expense-alquiler", categoryId: "alquiler", detail: "Alquiler nuevo", amountCents: 52_000_000, paidOn: "2026-08-07" },
  { id: "expense-deuda-gato", categoryId: "deudas", detail: "Deuda Gato", amountCents: 1_388_000, paidOn: "2026-09-19" },
  { id: "expense-deuda-basilis", categoryId: "deudas", detail: "Deuda Basilis", amountCents: 45_950_000, paidOn: "2026-09-19" },
  { id: "expense-contador", categoryId: "contador", detail: "Contador", amountCents: 6_000_000, paidOn: "2026-09-05" },
  { id: "expense-viaticos", categoryId: "viaticos", detail: "5/8, 15/08 y 29/08", amountCents: 18_000_000, paidOn: "2026-08-05" },
  { id: "expense-luz", categoryId: "luz", detail: "Luz agencia nueva", amountCents: 10_655_000, paidOn: "2026-08-07" },
  { id: "expense-libreria", categoryId: "libreria", detail: "Librería", amountCents: 140_000, paidOn: "2026-08-22" },
  { id: "expense-suplente", categoryId: "suplente", detail: "2/8, 5/8, 7/8, 12/8, 20/8, 28/8 y 30/8", amountCents: 28_000_000, paidOn: "2026-08-02" },
  { id: "expense-bidones", categoryId: "bidones", detail: "10/8 y 27/8", amountCents: 1_200_000, paidOn: "2026-08-10" },
  { id: "expense-productos-limpieza", categoryId: "productos-limpieza", detail: "6/8, 10/8, 21/8 y 29/8", amountCents: 1_650_000, paidOn: "2026-08-06" },
  { id: "expense-administracion", categoryId: "administracion", detail: "Administración", amountCents: 25_000_000, paidOn: "2026-09-01" },
  { id: "expense-adelanto-mati", categoryId: "adelanto-mati", detail: "5/9 y 11/9", amountCents: 150_000_000, paidOn: "2026-09-05" },
  { id: "expense-adelanto-fede", categoryId: "adelanto-fede", detail: "5/9, 11/9 y 18/9", amountCents: 200_000_000, paidOn: "2026-09-05" },
];

function expenses(): Expense[] {
  return expenseSeeds.map((seed) => {
    const category = getExpenseCategory(seed.categoryId);
    return {
      id: seed.id,
      agencyId: PREVIEW_AGENCY_ID,
      month: PREVIEW_MONTH,
      paidOn: seed.paidOn,
      categoryId: category.id,
      detail: seed.detail,
      amountCents: seed.amountCents,
      kind: category.kind,
    };
  });
}

export function createAugust2026Snapshot(): LedgerSnapshot {
  return {
    agencyId: PREVIEW_AGENCY_ID,
    month: PREVIEW_MONTH,
    days: sales.map((sale) => ({ ...sale, agencyId: PREVIEW_AGENCY_ID })),
    deposits: deposits.map((deposit) => ({ ...deposit, agencyId: PREVIEW_AGENCY_ID })),
    expenses: expenses(),
    openingBalances: openingBalances.map((opening) => ({ ...opening })),
  };
}
