/** Ionicons name. Kept as a string so this file has no React Native import. */
export type FaqIcon =
  | "help-circle-outline"
  | "phone-portrait-outline"
  | "pricetag-outline"
  | "swap-horizontal-outline"
  | "rocket-outline"
  | "calendar-outline"
  | "calculator-outline"
  | "people-outline"
  | "lock-closed-outline"
  | "create-outline"
  | "mail-open-outline"
  | "key-outline";

export type FaqItem = {
  icon: FaqIcon;
  question: string;
  /** The answer in one short line. Shown first, in bold. */
  lead: string;
  /** Optional sentence after the lead. */
  detail?: string;
  /** Optional list under the detail. */
  points?: readonly string[];
  /** True when the points are steps in order. */
  numbered?: boolean;
};

export type FaqGroup = {
  title: string;
  items: readonly FaqItem[];
};

/** Draft for Federico to review. Shown on /entrada and in Ayuda. */
export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    title: "Qué es HippoPro",
    items: [
      {
        icon: "help-circle-outline",
        question: "¿Qué es HippoPro?",
        lead: "Es el cuaderno de cuentas de tu agencia, en el celular o la computadora.",
        detail: "Anotás lo que se vendió cada día y HippoPro hace las cuentas solo:",
        points: [
          "Cuánto ganó la agencia de comisión.",
          "Cuánto le debés a cada hipódromo o a la lotería.",
          "Cuánto quedó en el mes, después de los gastos.",
        ],
      },
      {
        icon: "phone-portrait-outline",
        question: "¿Tengo que instalar algo?",
        lead: "No. Se abre desde el navegador, como cualquier página.",
        detail:
          "Funciona en la computadora y en el celular. Si querés, en el celular lo agregás a la pantalla de inicio y queda como una app más.",
      },
      {
        icon: "pricetag-outline",
        question: "¿Cuánto cuesta?",
        lead: "Por ahora es gratis.",
        detail: "Si algún día se cobra, te avisamos antes.",
      },
      {
        icon: "swap-horizontal-outline",
        question: "¿Sirve para hípica, lotería o las dos?",
        lead: "Para las dos.",
        detail: "Empezás con una. Cuando quieras, desde adentro sumás la otra, y lo que ya cargaste queda guardado.",
      },
    ],
  },
  {
    title: "Para empezar",
    items: [
      {
        icon: "rocket-outline",
        question: "¿Cómo empiezo?",
        lead: "Te lleva unos minutos.",
        numbered: true,
        points: [
          "Tocá «Empezar con hípica» o «Empezar con lotería».",
          "Escribí el nombre de tu agencia, tu correo y una contraseña.",
          "Anotá con cuánto arrancás y tus hipódromos o juegos.",
          "Listo: ya podés cargar el primer día.",
        ],
      },
      {
        icon: "calendar-outline",
        question: "¿Tengo que cargar los meses anteriores?",
        lead: "No.",
        detail: "Arrancás desde hoy, con el saldo que tenés ahora. Lo de antes queda en tu planilla.",
      },
      {
        icon: "calculator-outline",
        question: "¿Cómo se calcula la comisión?",
        lead: "Sola.",
        detail:
          "Vos cargás lo que se vendió y HippoPro le aplica el porcentaje de cada hipódromo o juego. Los porcentajes los anotás una vez, al empezar.",
      },
      {
        icon: "people-outline",
        question: "¿Puede cargar mi empleado?",
        lead: "Sí, con su propia cuenta.",
        detail:
          "Lo invitás por correo desde Operadores. El operador carga el día. El resultado del mes lo ve solo el dueño.",
      },
    ],
  },
  {
    title: "Tus datos y tu cuenta",
    items: [
      {
        icon: "lock-closed-outline",
        question: "¿Mis datos los ve otra agencia?",
        lead: "No. Cada agencia ve solo lo suyo.",
        detail:
          "Tu libro lo ven vos y las personas que invitás. El equipo de HippoPro también puede verlo, solo para ayudarte si lo necesitás.",
      },
      {
        icon: "create-outline",
        question: "¿Y si me equivoco al cargar?",
        lead: "Lo corregís.",
        detail: "Cualquier movimiento se edita o se quita. Queda un historial de cada cambio: quién lo hizo y cuándo.",
      },
      {
        icon: "mail-open-outline",
        question: "Me invitaron, ¿qué hago?",
        lead: "Abrí el correo de HippoPro.",
        numbered: true,
        points: [
          "Tocá el enlace del correo.",
          "Elegí tu contraseña y repetila.",
          "Listo: entrás directo a la agencia.",
        ],
      },
      {
        icon: "key-outline",
        question: "Olvidé mi contraseña",
        lead: "Se recupera en un minuto.",
        numbered: true,
        points: [
          "Tocá «Entrar», arriba a la derecha.",
          "Tocá «Olvidé mi contraseña» y escribí tu correo.",
          "Abrí el enlace que te llega y elegí una nueva.",
        ],
      },
    ],
  },
];
