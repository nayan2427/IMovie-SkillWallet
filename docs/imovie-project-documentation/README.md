# iMovie — Full Stack Development Project Documentation Package

Welcome to the comprehensive Full Stack Development (FSD) technical documentation package for **iMovie** (branded as **IMovies**).

This folder contains the complete academic and engineering documentation, technical specifications, and six verified Mermaid architecture diagrams prepared for college project submissions, viva examinations, and technical architecture reviews.

---

## 📁 Package Structure

```
docs/imovie-project-documentation/
├── README.md                                 # This guide: documentation overview & diagram rendering
├── IMOVIE_FSD_PROJECT_DOCUMENTATION.md       # Master 13-section FSD document with Appendices A-G
├── ANALYSIS_GAPS.md                         # Gaps, assumptions, and project owner checklist
└── diagrams/                                 # Six separate, standalone Mermaid diagram source files
    ├── 01-technical-architecture.mmd         # Full-stack topology, client/server/database tiers
    ├── 02-er-diagram.mmd                     # Relational schema, 10 entities, PKs, FKs, constraints
    ├── 03-features-diagram.mmd               # Functional hierarchy & implementation status map
    ├── 04-roles-responsibilities.mmd         # RBAC matrix and use case boundaries (Guest, Customer, Admin)
    ├── 05-user-flow.mmd                      # User journey, branching logic, concurrency & payment checks
    └── 06-mvc-pattern.mmd                    # Modern decoupled MVC interaction & sequence lifecycle
```

---

## 🎨 How to Render and View the Diagrams

Each diagram file under `diagrams/` contains syntactically validated Mermaid source code. You can view, render, and export them using several convenient methods:

### Option 1: VS Code / IDE Preview (Recommended)
1. Install the **Markdown Preview Mermaid Support** or **Mermaid Previewer** extension in your IDE.
2. Open any `.mmd` file or the master documentation file `IMOVIE_FSD_PROJECT_DOCUMENTATION.md`.
3. Press `Ctrl + Shift + V` (Windows) to view the rendered diagrams live.

### Option 2: Mermaid Live Editor (Browser)
1. Visit [https://mermaid.live](https://mermaid.live).
2. Open any `.mmd` file in a text editor, copy its entire contents, and paste it into the code editor on `mermaid.live`.
3. You can interactively pan, zoom, edit styles, and export high-resolution PNG or SVG images for your project report or presentation slides.

### Option 3: Command-Line Export (Mermaid CLI)
If you have Node.js installed, you can render all diagrams to PNG or PDF using `@mermaid-js/mermaid-cli`:

```bash
# Install Mermaid CLI globally or run with npx:
npx @mermaid-js/mermaid-cli -i diagrams/01-technical-architecture.mmd -o diagrams/01-technical-architecture.png
npx @mermaid-js/mermaid-cli -i diagrams/02-er-diagram.mmd -o diagrams/02-er-diagram.png
npx @mermaid-js/mermaid-cli -i diagrams/03-features-diagram.mmd -o diagrams/03-features-diagram.png
npx @mermaid-js/mermaid-cli -i diagrams/04-roles-responsibilities.mmd -o diagrams/04-roles-responsibilities.png
npx @mermaid-js/mermaid-cli -i diagrams/05-user-flow.mmd -o diagrams/05-user-flow.png
npx @mermaid-js/mermaid-cli -i diagrams/06-mvc-pattern.mmd -o diagrams/06-mvc-pattern.png
```

### Option 4: GitHub Native Rendering
GitHub natively renders Mermaid code blocks in Markdown files. When you push this folder to your GitHub repository (`nayan2427/IMovie-SkillWallet`), the diagrams embedded in `IMOVIE_FSD_PROJECT_DOCUMENTATION.md` will render automatically in your browser.

---

## 📋 Viva & Project Submission Guidelines

For your college evaluation and project viva:
1. **Master Report**: Print or export `IMOVIE_FSD_PROJECT_DOCUMENTATION.md` to PDF.
2. **Student Details**: Fill in your Student Name, University Roll Number, Degree Program, and Academic Year in Section 1.
3. **Screenshots**: Run the application locally (`npm run dev`), capture real screenshots of the key screens listed in `ANALYSIS_GAPS.md`, and place them in the document's Section 11.
4. **Automated Testing Demonstration**: During the live demonstration, run `npm test` in the terminal to show the examiners that all 148 automated tests pass.
