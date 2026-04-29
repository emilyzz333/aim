---
name: Apple Design System Implementation
description: Project uses Apple-inspired design system for all UI components. Reference DESIGN_apple.md and apple-theme.ts for styling guidelines.
type: project
---

The project has adopted Apple's design language as the primary design system for all frontend components.

**Why:** User requested a cohesive, premium design aesthetic inspired by apple.com. This provides a consistent, professional look across the entire application.

**How to apply:**

## Design Files
- **DESIGN_apple.md** (project root): Complete Apple design system specification with colors, typography, spacing, and component patterns
- **frontend/src/styles/apple-theme.ts**: TypeScript constants for colors, fonts, shadows, and common styles
- **frontend/src/styles/apple-antd-override.css**: Global CSS overrides for Ant Design components

## Key Design Principles

### Colors
- Primary: Apple Blue `#0071e3` (all interactive elements, links, primary buttons)
- Background: Light gray `#f5f5f7` (page backgrounds)
- Surface: White `#ffffff` (cards, modals, sidebars)
- Text: Near black `#1d1d1f` (headings), `rgba(0,0,0,0.8)` (body text)
- Borders: `rgba(0,0,0,0.1)` (subtle dividers)

### Typography
- **Font Family**: SF Pro Display (20px+), SF Pro Text (<20px)
- **Headings**: 40-56px, weight 600, tight line-height (1.07-1.14), negative letter-spacing
- **Body**: 14-17px, weight 400, comfortable line-height (1.47)
- **Buttons**: 14px, weight 400

### Components
- **Buttons**: Primary = pill-shaped (980px radius), Secondary = 8px radius
- **Cards**: 18px border-radius, shadow `rgba(0,0,0,0.08) 0px 2px 12px`
- **Inputs**: 8px border-radius, 40px height, minimal borders
- **Tables**: 12px border-radius, header background `#f5f5f7`
- **Navigation**: Translucent with backdrop-filter blur(20px)

### Layout
- Page containers: `padding: 32px 40px`, background `#f5f5f7`
- Generous whitespace between sections
- Maximum content width: 980px for centered layouts
- Grid gaps: 12-24px

## Implementation Status
- ✅ Login page
- ✅ Home page
- ✅ Sidebar and navigation
- ✅ Iterations page (partial)
- ✅ Requirements page (partial)
- ✅ Bugs page (partial)
- ✅ Global Ant Design overrides

## When Creating New Components
1. Import styles from `apple-theme.ts`
2. Use SF Pro font family
3. Apply Apple Blue for primary actions
4. Use pill-shaped buttons for CTAs
5. Maintain 8px base spacing unit
6. Keep interfaces minimal and content-focused
7. Avoid heavy shadows, gradients, or textures

## References
- Design spec: `/DESIGN_apple.md`
- Theme constants: `/frontend/src/styles/apple-theme.ts`
- Global overrides: `/frontend/src/styles/apple-antd-override.css`
- Project config: `/openspec/config.yaml`
