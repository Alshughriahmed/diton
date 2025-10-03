/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  safelist: [
    {
      pattern: /^(bg|from|to|via)-(slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-(50|100|200|300|400|500|600|700|800|900|950)$/,
    },
    {
      pattern: /^(text|border|ring)-(slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|white|black)-(50|100|200|300|400|500|600|700|800|900|950)?$/,
    },
    {
      pattern: /^(hover|focus|active):(bg|text|border|ring|scale|opacity)-.+$/,
    },
    {
      pattern: /^(sm:|md:|lg:|xl:|2xl:).+$/,
    },
    {
      pattern: /^(rounded|shadow|max-w|min-w|w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|flex|grid|transform|transition|scale|opacity|disabled)-.+$/,
    },
    'container',
    'mx-auto',
    'antialiased',
    'bg-clip-text',
    'text-transparent',
  ],
  darkMode: "class",
  theme: { extend: {} },
  plugins: []
};