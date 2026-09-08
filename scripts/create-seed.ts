import { readFileSync, writeFileSync } from "node:fs";
import { type Block, type Kind, type Config, type Site } from "../lib/model";
const lines = readFileSync("website.txt", "utf8").split(/\r?\n/);
const line = (n: number) => lines[n - 1].trim().replace(/[—–]/g, " - ");
const quote = (n: number) => line(n).replace(/^“|”$/g, "");
let seq = 0;
function n(
  kind: Kind,
  label: string,
  text = "",
  children: Block[] = [],
  config: Config = {},
  id?: string,
): Block {
  return {
    id: id || `content-${++seq}`,
    kind,
    label,
    text,
    children,
    config,
    style: {},
    hidden: false,
    reportOnly: false,
  };
}
const p = (label: string, text = "Not supplied") => n("paragraph", label, text);
const fields = (pairs: Record<string, string>) =>
  Object.entries(pairs).map(([a, b]) => p(a, b));
const image = (id: string, label: string) =>
  n(
    "image",
    label,
    "",
    [],
    {
      src: "/placeholder.svg",
      alt: `Neutral placeholder for ${label.toLowerCase()}; photograph not supplied`,
      caption: "Photograph not supplied",
      credit: "Not supplied",
      source: "",
      fit: id === "porter-hero-image" ? "cover" : "contain",
      position: "50% 50%",
      overlay: id === "porter-hero-image" ? 0.65 : 0,
    },
    id,
  );
const citation = (refId = "", text = "Evidence required") =>
  n("citation", "Citation", text, [], { refId });
const evidence = (statement: string, refId = "") =>
  n("evidence", "View evidence", "", [
    ...fields({
      Finding: statement,
      "Evidence type": "Author interpretation",
      Limitation:
        "Evidence required. This is a proposed interpretation, not a verified research result.",
      Implication: "Validate with documented research before final submission.",
    }),
    citation(refId),
  ]);
const button = (
  label: string,
  destination: string,
  action: Config["action"] = "section",
) => n("button", label, label, [], { action, destination });
function interaction(
  title: string,
  options: string[],
  feedback: string[],
  id?: string,
) {
  return n(
    "interaction",
    title,
    title,
    options.map((o, i) =>
      n("option", o, o, [p("Feedback", feedback[i] || feedback[0])]),
    ),
    {},
    id,
  );
}
const titles = [
  "Meet Porter",
  "How the Customer Was Researched",
  "Understanding Porter’s Digital Customer",
  "Meet Mia Daniels",
  "Mia’s Journey with Porter",
  "The Channel Ecosystem",
  "Why These Channels Fit Mia",
  "How Success Will Be Measured",
  "Evidence Base",
];
const slugs = [
  "introduction",
  "research",
  "insights",
  "persona",
  "journey",
  "peso",
  "channels",
  "measurement",
  "references",
];
const sections = titles.map((t, i) => n("section", t, t, [], {}, slugs[i]));
const [
  intro,
  research,
  insights,
  persona,
  journey,
  peso,
  channels,
  measurement,
  references,
] = sections;
const hero = n(
  "hero",
  "Landing page",
  "",
  [
    p(
      "Academic label",
      "Digital Marketing Assignment 1 | Stellenbosch University | 2026",
    ),
    p("Concept", "Step Into Mia’s Digital World"),
    n(
      "heading",
      "Hero title",
      "Carrying Porter Through the Digital Journey",
      [],
      {},
      "hero-title",
    ),
    p(
      "Hero subtitle",
      "A digital customer profile, journey and channel strategy for Porter Luxury Carriers.",
    ),
    p(
      "Hero introduction",
      "This project investigates how Porter’s proposed target customer discovers, evaluates and purchases carriers online, and how a connected digital journey can guide her from discovery to advocacy.",
    ),
    button("Step Into Mia’s Journey", "occasion"),
    button("View Full Academic Content", "", "report"),
    p(
      "Disclaimer",
      "This independent academic project was prepared for educational purposes and is not an official Porter Luxury Carriers website.",
    ),
    image("porter-hero-image", "Hero image"),
  ],
  {},
  "hero",
);
const occasion = interaction(
  "What is Mia carrying for?",
  [
    "Work and everyday life",
    "Weekend and travel",
    "Gifting and personalisation",
  ],
  [
    quote(120).split(": “")[1]?.replace(/”$/, "") ||
      "Follow Mia as she looks for expressive design that can accompany a busy working day.",
    "Follow Mia as she compares versatility, carrying comfort and practical product information.",
    "Follow Mia as she weighs personalisation, presentation and delivery confidence for a thoughtful gift.",
  ],
  "occasion",
);
occasion.children[0].children[0].text =
  "Follow Mia as she looks for expressive design that can accompany a busy working day.";
intro.children = [
  p("Introduction", quote(132)),
  p(
    "Source status",
    "Brand details supplied in the assignment brief; source verification required. No claim is made that every component is South African-made or that environmental benefits are independently verified.",
  ),
  n(
    "list",
    "Brand characteristics",
    "",
    [
      "Expressive colour and pattern",
      "Everyday versatility",
      "Personalisation",
      "Selected local craftsmanship",
      "Accessible-premium positioning",
      "Online and selected physical availability",
    ].map((t) => p("Characteristic", t)),
  ),
  n("timeline", "Porter at a glance", "", [
    n("moment", "2021", "Establishment"),
    n(
      "moment",
      "Date unconfirmed",
      "Development of leather, woven and knitted collections",
    ),
    n(
      "moment",
      "Dates unconfirmed",
      "Growth through e-commerce, social media, retailers and pop-ups",
    ),
    n(
      "moment",
      "Proposed present focus",
      "Digital reach and online conversion",
    ),
  ]),
  image("porter-product-image-1", "Products collage"),
  image("porter-personalisation-image", "Personalisation"),
  evidence(
    "Expressive colour, everyday versatility and personalisation are the proposed digital focus.",
    "ref-porter-website",
  ),
];
research.children = [
  p("Methodology", quote(143)),
  n(
    "card",
    "Survey record",
    "",
    fields({
      Method: "Google Forms",
      "Sample method": "Convenience sampling",
      "Sample size": "Not supplied",
      "Collection date range": "Not supplied",
      "Recruitment method": "Not supplied",
      "Survey purpose": "Not supplied",
      "Actual questions": "Not supplied",
      "Aggregate results": "Not supplied",
      "Source label": "Author’s primary research, 2026",
      Limitations:
        "Exploratory convenience sample; findings are directional and cannot be generalised to all Porter customers.",
    }),
  ),
  citation("ref-survey", "Author’s primary research, 2026"),
  ...Array.from({ length: 7 }, (_, i) => {
    const t = line(148 + i).replace(/^\d\) /, "");
    return n(
      "card",
      t.split(" - ")[0],
      t,
      fields({
        "Source / platform": t.split(" - ")[0],
        Purpose: "Not supplied",
        Procedure: "Not documented",
        "Evidence gathered":
          i === 0
            ? "Survey collected; aggregate results awaiting entry"
            : "Not documented",
        Limitations: "Evidence required; do not infer representative sampling.",
        Status: i === 0 ? "Conducted" : "Not documented",
      }),
    );
  }),
];
insights.children = [
  p("Insights introduction", quote(165)),
  n(
    "card",
    "Proposed primary profile",
    "Expressive Everyday Professionals, provisionally aligned with Eighty20’s Middle Class Workers segment.",
    [
      p(
        "Targeting choices",
        "Employed, digitally connected South African women approximately 25-55, particularly in urban Western Cape and Gauteng, seeking distinctive design, versatility, quality and credible value. Age, geography and segment alignment are proposed targeting choices. The ENS segment is not exclusively female; alignment is not established by Porter transactions.",
      ),
      citation("ref-eighty20"),
    ],
  ),
  ...Array.from({ length: 5 }, (_, i) => {
    const t = line(168 + i).replace(/^[A-E]\. /, "");
    return n("card", t.split(":")[0], t.split(": ").slice(1).join(": "), [
      evidence(t),
    ]);
  }),
  n(
    "survey",
    "What the Survey Revealed",
    "Survey results awaiting entry",
    [
      p("Question wording"),
      p("Collection period"),
      p("Interpretation"),
      p("Porter implication"),
      n("option", "Result option", "Not supplied", [], { count: 0 }),
      p("Qualitative findings", "Survey results awaiting entry"),
    ],
    { denominator: 0, multiselect: false },
  ),
  n("quote", "Strategic insight", quote(179), [
    p("Attribution", "Author interpretation"),
    citation(),
  ]),
];
persona.children = [
  p("Persona note", line(183).match(/“(.+?)”/)?.[1] || ""),
  p(
    "Evidence status",
    "Unsupported attributes are author-developed assumptions.",
  ),
  image("mia-persona-image", "Mia persona portrait"),
  n(
    "group",
    "Complete persona",
    "",
    Array.from({ length: 20 }, (_, i) => {
      const t = line(186 + i).replace(/^- /, "");
      return p(t.split(":")[0], t.split(": ").slice(1).join(": "));
    }),
  ),
  n("quote", "Mia’s words", line(207).match(/“(.+?)”/)?.[1] || "", [
    p(
      "Attribution",
      "Representative fictional statement developed by the author.",
    ),
  ]),
  ...[
    "Expressive / understated",
    "Practical / decorative",
    "Considered / impulsive",
    "Digital-first / store-first",
    "Price-conscious / quality-led",
  ].map((t) =>
    n(
      "scale",
      t,
      t,
      [
        p(
          "Interpretation",
          "Illustrative marker, not a research percentage. Author-developed assumption.",
        ),
      ],
      { min: 0, max: 100, marker: 50 },
    ),
  ),
  image("mia-bag-image", "Mia’s bag"),
  interaction(
    "What’s Inside Mia’s Porter?",
    [
      "Laptop",
      "Smartphone",
      "Diary",
      "Sunglasses",
      "Cosmetics",
      "Water bottle",
      "Travel item",
      "Gift",
    ],
    [
      "Employed professional",
      "Mobile discovery",
      "Time-conscious routine",
      "Styling and social occasions",
      "Personal presentation",
      "Practical capacity needs",
      "Versatility",
      "Personalisation and gifting",
    ],
  ),
  p(
    "Bag caveat",
    "These objects represent needs, not verified contents or proven capacity of the pictured product.",
  ),
  n(
    "timeline",
    "A Day in Mia’s Digital Life",
    "Illustrative scenario developed by the author; not a recorded customer diary.",
    [
      [
        "07:30",
        "Checks Instagram",
        "Instagram",
        "Discover expressive design",
        "Colour-led styling Reel",
        "Reach",
      ],
      [
        "12:30",
        "Saves a Porter Reel",
        "Instagram",
        "Return to an idea later",
        "Use demonstration",
        "Saves",
      ],
      [
        "17:45",
        "Searches for the product",
        "Google Search",
        "Find practical product information",
        "Accurate product pages",
        "Relevant visits",
      ],
      [
        "20:00",
        "Compares dimensions, materials and reviews",
        "Website",
        "Reduce perceived risk",
        "Dimensions, materials and independent reviews",
        "Engaged sessions",
      ],
      [
        "20:15",
        "Joins a restock list",
        "Website / email",
        "Receive relevant stock information",
        "Opted-in restock notice",
        "Email sign-ups",
      ],
      [
        "Later",
        "Receives email and purchases",
        "Email / website",
        "Act on existing interest",
        "Relevant restock message",
        "Conversion",
      ],
    ].map(([time, title, channel, motivation, content, kpi]) =>
      n("moment", time, title, [
        ...fields({
          Channel: channel,
          Motivation: motivation,
          "Recommended content": content,
          KPI: kpi,
          Limitation:
            "Illustrative author-developed scenario. Journeys can loop or stop.",
        }),
        citation(),
      ]),
    ),
  ),
];
const stageNames = [
  "Awareness",
  "Consideration",
  "Purchase",
  "Retention",
  "Advocacy",
];
journey.children = [
  p(
    "Journey note",
    "Actual journeys can loop or stop. This illustrative sequence is not a recorded customer journey.",
  ),
  p(
    "Emotional sequence",
    "Curious → Interested → Reassured → Satisfied → Proud and connected",
  ),
  ...stageNames.map((title, i) => {
    const start = 222 + i * 10;
    const details = Array.from({ length: 7 }, (_, j) => {
      const t = line(start + j);
      return p(
        t.split(":")[0],
        t.split(": ").slice(1).join(": ").replace(/^“|”$/g, ""),
      );
    });
    const decision = line(start + 7);
    const question = decision.match(/“(.+?)”/)?.[1] || "";
    const optionText = decision.match(/Options: (.+?)\./)?.[1] || "";
    const feedback =
      decision.split("Feedback")[1]?.replace(/^( respectively)?: /, "") ||
      decision
        .slice(decision.indexOf("Options:") + 8 + optionText.length + 1)
        .trim();
    return n(
      "stage",
      title,
      title,
      [
        ...details,
        evidence(`Proposed ${title.toLowerCase()} strategy`),
        interaction(
          question,
          optionText.split(" / ").map((t) => t.trim()),
          optionText
            .split(" / ")
            .map((_, j) => feedback.split("; ")[j] || feedback),
        ),
      ],
      {},
      `stage-${title.toLowerCase()}`,
    );
  }),
];
const demo = n(
  "card",
  "From Attraction to Assurance",
  "Illustrative Porter carrier",
  [
    image("journey-product-image", "Product information demonstration"),
    p("Price", "Price not supplied"),
    interaction(
      "Buy Now - demo",
      ["Explain the simulation"],
      [
        "This is an academic simulation. No purchase, checkout or payment occurs.",
      ],
    ),
    interaction(
      "Does Mia have enough information to purchase confidently?",
      ["Yes", "Not yet"],
      [
        "Consider the evidence categories below. These are recommended information categories, not verified specifications of the pictured product.",
      ],
    ),
    n(
      "group",
      "Recommended evidence categories",
      "",
      [
        "Dimensions",
        "Capacity / use demonstration",
        "Materials / construction",
        "Close-ups",
        "Independent reviews",
        "Care",
        "Delivery",
        "Returns",
        "Personalisation",
      ].map((t) => p(t)),
    ),
    n(
      "quote",
      "Conversion interpretation",
      "Online conversion depends on reducing perceived risk, not only presenting an attractive product.",
      [p("Attribution", "Author interpretation"), citation()],
    ),
  ],
);
journey.children
  .find((s) => s.id === "stage-consideration")!
  .children.push(demo);
peso.children = [
  p(
    "Convention",
    line(289)
      .replace(/^Add a brief note that /, "")
      .replace(/ This corrects[\s\S]+$/, ""),
  ),
  p(
    "Connection",
    "Paid / shared discovery → earned proof and owned information → owned purchase / retention → earned / shared advocacy.",
  ),
  ...["Paid", "Earned", "Shared", "Owned"].map((t, i) =>
    n(
      "peso",
      t,
      t,
      fields({
        "Channel examples": line(284 + i).replace(/^- [^:]+: /, ""),
        Function: [
          "Targeted distribution",
          "Third-party credibility",
          "Participation and conversation",
          "Detailed information and direct communication",
        ][i],
        "Journey stages": [
          "Awareness, consideration, purchase",
          "Awareness, consideration, advocacy",
          "Awareness, consideration, retention, advocacy",
          "Consideration, purchase, retention, advocacy",
        ][i],
        Strengths: [
          "Reach relevant audiences",
          "Independent reassurance",
          "Community participation",
          "Control over accurate information",
        ][i],
        Limitations: [
          "Cost, targeting constraints and lawful tracking choices",
          "Limited control",
          "Platform dependence",
          "Requires traffic and maintenance",
        ][i],
        "Porter application": [
          "Relevant discovery and product reminders",
          "Honest reviews and independent mentions",
          "Styling, customer tags and conversation",
          "Accurate product pages and opted-in email",
        ][i],
        Citation: "Evidence required",
      }),
    ),
  ),
];
channels.children = [
  p("Channel strategy", quote(309)),
  ...Array.from({ length: 8 }, (_, i) => {
    const text = line(299 + i);
    const [title, ...parts] = text.split(": ");
    const clauses = parts.join(": ").split("; ");
    return n(
      "channel",
      title,
      parts.join(": "),
      fields({
        "Behaviour addressed": clauses[0],
        "Journey role":
          i === 2
            ? "Retention and repeat consideration"
            : i === 5
              ? "Consideration and advocacy"
              : "Discovery, evaluation and appropriate next steps",
        Suitability: clauses[1] || clauses[0],
        Content: clauses[2] || clauses[1] || clauses[0],
        Measurement:
          clauses.find((c) => c.includes("measure")) ||
          "Documented referrals and outcomes where available",
        Limitation: clauses.at(-1) || "Evidence required",
        "Evidence / citation":
          "Evidence required. Reasoned recommendation, not a survey-proven outcome.",
      }),
    );
  }),
  image("porter-social-content-image", "Social content"),
  image("porter-retail-or-popup-image", "Retailer or pop-up"),
  interaction(
    "What Should Porter Prioritise?",
    [
      "Rapid permanent-store expansion",
      "Lower prices / discounts",
      "Content-led digital customer journey",
    ],
    [
      "Stores can provide tactile reassurance but require investment and validated economics.",
      "Discounts can support specific objectives but may weaken margin and value perception.",
      "A connected digital journey is the proposed priority given this project’s scope and Porter’s stated resource constraints. This is not statistically proven by the survey.",
    ],
  ),
  evidence(quote(309)),
];
measurement.children = [
  p("Measurement introduction", quote(318)),
  n(
    "card",
    "Plan dates",
    "",
    fields({
      "Plan starts": "8 September 2026",
      "Plan ends": "7 September 2027",
      Assessment: "8 September 2027",
      "Baseline annual sales period": "8 September 2025 to 7 September 2026",
      "Monthly comparison":
        "Compare the final 30 days with a documented 30-day launch baseline. Use like-for-like definitions and consider seasonality.",
    }),
  ),
  n("quote", "Follower objective", line(323).match(/“(.+?)”/)?.[1] || "", [
    p("Net increase", "3,900"),
    p(
      "Caveat",
      "Student-reported approximate starting count. Follower count does not prove audience relevance or sales.",
    ),
  ]),
  n("quote", "Revenue objective", line(324).match(/“(.+?)”/)?.[1] || "", [
    p("Baseline revenue", "Not supplied"),
    p("Target multiplier", "1.20"),
    p("Increase multiplier", "0.20"),
    p(
      "Feasibility",
      "Provisional until baseline, budget and feasibility are verified.",
    ),
  ]),
  p(
    "Plan caveat",
    "These are independent proposed planning goals, not actual results, benchmarks or a reconciled financial forecast. No analytics accounts are connected.",
  ),
  ...[
    [327, 328, 331],
    [332, 333, 338],
    [339, 340, 345],
    [346, 347, 353],
  ].map(([heading, start, end]) =>
    n(
      "group",
      line(heading).replace(/:$/, ""),
      "",
      Array.from({ length: end - start + 1 }, (_, i) => {
        const text = line(start + i).replace(/^- /, "");
        const title = text.split(":")[0];
        const parts = text.split(": ").slice(1).join(": ").split("; ");
        const k = n(
          "kpi",
          title,
          parts[0],
          fields({
            Definition: parts.slice(1).join("; ") || text,
            Baseline:
              title === "Instagram followers"
                ? "Approximately 15,600; student-reported, exact count not confirmed"
                : "Not supplied",
            "Proposed target": parts[0],
            "Measurement period": "8 September 2026 to 7 September 2027",
            "Data source":
              start === 328
                ? "Instagram Insights / dated profile record"
                : start === 333
                  ? "Configured website analytics / Meta / email platform as applicable"
                  : start === 340
                    ? "E-commerce order reports"
                    : "Email platform / operational records",
            "Review frequency": "Monthly monitoring; quarterly review",
            "Owner note":
              "Proposed; validate baseline, availability and capacity.",
            "Actual result": "",
          }),
        );
        if (title === "Email engagement")
          k.children.push(
            p("Open rate target", "At least 35% of delivered emails"),
            p("Unique click rate target", "At least 3% of delivered emails"),
          );
        return k;
      }),
    ),
  ),
  image("porter-packaging-image", "Packaging"),
];
const refData = [
  ["academic", "Academic literature used", "academic"],
  ["base44", "Base44", "AI tools"],
  ["openai", "ChatGPT / OpenAI", "AI tools"],
  ["eighty20", "Eighty20 publication", "consumer / segmentation"],
  ["industry", "Industry report used", "industry / market"],
  ["lecture", "Lecture slides", "lecture material"],
  ["porter-instagram", "Porter Instagram", "Porter / competitor"],
  ["porter-website", "Porter website", "Porter / competitor"],
  ["survey", "Student’s Google Forms survey", "primary research"],
];
references.children = [
  p(
    "Reference status",
    "Incomplete source records are shown honestly. Bibliographic details must be supplied and verified before submission.",
  ),
  ...refData.map(([key, title, type]) =>
    n(
      "reference",
      title,
      title,
      fields({
        "Author / organisation":
          key === "survey" ? "Author name not supplied" : "Not supplied",
        Year: key === "survey" ? "2026" : "Not supplied",
        Suffix: "",
        Title:
          key === "survey" ? "Porter digital marketing survey" : "Not supplied",
        "Publication / website":
          key === "survey" ? "Unpublished Google Forms survey" : "Not supplied",
        Edition: "Not supplied",
        "Volume / issue / pages": "Not supplied",
        "URL / DOI": "",
        "Access date": "Not supplied",
        "Source type": type,
        "Verification status": "Incomplete; evidence required",
        "Full reference override": "",
        "Collection / sample details": key === "survey" ? "Not supplied" : "",
      }),
      {},
      `ref-${key}`,
    ),
  ),
  n(
    "card",
    "AI disclosure",
    "ChatGPT was used to assist with research organisation, interpretation, drafting and the development of website instructions. The source history describes an earlier AI website-building attempt with Base44. This standalone website was implemented with AI coding assistants: OpenAI Codex and Anthropic Claude Code. The student is responsible for checking the sources, reviewing the outputs and editing the final submission. AI-generated material was not treated as primary research.",
    fields({
      "AI-use dates": "Not supplied",
      "Final verification": "Not confirmed",
    }),
  ),
];
const meta = n(
  "metadata",
  "Assignment details",
  "",
  fields({
    "Student name": "Not supplied",
    "Student number": "Not supplied",
    "Module name / code": "Not supplied",
    Lecturer: "Not supplied",
    "Submission date": "8 September 2026",
    Institution: "Stellenbosch University",
    "Site title": "Porter | Mia’s Digital World",
    "Site description":
      "An independent digital marketing assignment exploring Porter’s proposed customer journey.",
  }),
);
const theme = n(
  "theme",
  "Global theme",
  "Changes here affect the whole site.",
  fields({
    Cream: "#F7F3EB",
    Burgundy: "#7B2035",
    Brown: "#30271F",
    Blue: "#DDEBF1",
    Yellow: "#F5E8B8",
    Tan: "#C6AA87",
    Neutral: "#E8DED0",
    "Display font": "Georgia, serif",
    "Body font": "Arial, sans-serif",
    "Page width": "1200px",
    "Default spacing": "24",
    Animation: "On",
  }),
);
const nav = n(
  "group",
  "Navigation",
  "",
  slugs.map((s, i) =>
    button(
      [
        "Introduction",
        "Research",
        "Insights",
        "Persona",
        "Journey",
        "PESO",
        "Channels",
        "Measurement",
        "References",
      ][i],
      s,
    ),
  ),
);
const footer = n(
  "footer",
  "Footer",
  "Porter Luxury Carriers · An independent academic exploration.",
  [
    p(
      "Disclaimer",
      "Educational project. Not an official Porter website or a working store.",
    ),
    button("Return to beginning", "hero"),
    button("View full research", "", "report"),
    button("Open references", "references"),
    n("button", "Owner access", "Owner access", [], {
      action: "url",
      href: "/owner",
    }),
  ],
);
const summary = n(
  "card",
  "Journey summary",
  "Mia’s Digital Journey: Summary",
  [
    p("Completed title", "You Have Completed Mia’s Digital Journey"),
    p(
      "Summary",
      "The principal barriers are uncertain quality and capacity, unclear stock and service information, and premium value without proof. A connected, content-led journey should make expressive design discoverable and reduce practical uncertainty.",
    ),
    p("Recommendation", quote(309)),
  ],
  {},
  "summary",
);
research.children.push(
  n("table", "Research evidence register", "", [
    n("row", "Survey evidence", "", [
      n("cell", "Method cell", "Google Forms survey"),
      n("cell", "Status cell", "Conducted; aggregate results awaiting entry"),
      n("cell", "Source cell", "Author’s primary research, 2026"),
    ]),
    n("row", "Secondary evidence", "", [
      n("cell", "Method cell", "Secondary and observational methods"),
      n("cell", "Status cell", "Not documented"),
      n("cell", "Source cell", "Evidence required"),
    ]),
  ]),
);
hero.children.push(
  n("icon", "Woven accent", "", [], { icon: "✦", opacity: 0.35 }),
);
// Appended last so every existing generated id keeps its number.
theme.children.push(
  ...fields({
    "Dark cream": "#17130F",
    "Dark burgundy": "#E9A0AE",
    "Dark brown": "#EDE4D8",
    "Dark blue": "#1B2A32",
    "Dark yellow": "#2C2617",
    "Dark tan": "#A08A6A",
    "Dark neutral": "#3B332B",
  }),
);
const site: Site = {
  schemaVersion: 1,
  root: n(
    "site",
    "Porter assignment",
    "",
    [meta, theme, nav, hero, occasion, ...sections, summary, footer],
    {},
    "site",
  ),
};
writeFileSync("lib/seed.json", JSON.stringify(site, null, 2) + "\n");
console.log(
  `Created canonical seed with ${seq} generated records and stable named sections.`,
);
