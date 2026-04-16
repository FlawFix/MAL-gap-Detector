# MAL Gap Detector — Feature Spec

> Extend an existing Chrome Extension with new UI features and related functionality.

---

## Feature 1 — Floating Scroll Buttons

Add floating ↑ / ↓ buttons to the webpage that appear automatically when the site loads.

### 1.1 Automatic Injection

- Injected via content script whenever the user opens the target website.
- No popup interaction required — buttons appear on page load.
- Runs only on the intended domain (`myanimelist.net`).

### 1.2 Button Behavior

| Button | Icon | Action |
|--------|------|--------|
| Scroll Up | ↑ | Scrolls the page to the top |
| Scroll Down | ↓ | Scrolls the page to the bottom |

### 1.3 Positioning

- Bottom-right corner, stacked vertically with spacing.
- Remains visible (fixed position) while scrolling.

```
[ ↑ ]
[ ↓ ]
```

### 1.4 Scroll Speed

<!-- - Use `behavior: "smooth"` for responsive, non-abrupt scrolling. -->

### 1.5 Styling

| Property | Value |
|----------|-------|
| Shape | Circular (~40–48px) |
| Background | Semi-transparent dark |
| Icon color | White |
| Hover effect | Slight scale + glow / elevation |
| Shadow | Subtle, for visibility on varied backgrounds |
| Blocking | Must not obscure important page elements |

---

## Feature 2 — Rating Calculator Panel

Add a rating calculator to the popup UI that computes the average score across five categories.

### 2.1 Input Fields

Five numeric inputs (0–10), each with a placeholder hint `"0–10"`:

1. **Story**
2. **Character**
3. **Animation**
4. **Sound**
5. **Enjoyment**

### 2.2 Calculate Button

- Full-width, distinct accent color, hover animation.
- Label: **"Calculate Rating"**

### 2.3 Calculation Logic

1. Collect all five numeric values.
2. Compute the average.
3. Round: `≥ 0.5` → round up, `< 0.5` → round down.
4. Display the final integer rating.

**Example:**

| Story | Character | Animation | Sound | Enjoyment | Avg | Final |
|:-----:|:---------:|:---------:|:-----:|:---------:|:---:|:-----:|
| 8 | 7 | 8 | 7 | 8 | 7.6 | **8** |

### 2.4 Input Validation

- Clamp values to **0–10** on input.
- Prevent empty / invalid submissions (show error state).

### 2.5 Result Display

- Visually prominent container, centered text.
- Rounded corners, subtle shadow.
- Format: **`8 / 10 · Great`**

### 2.6 Dynamic Gradient Feedback

Color the result container based on the final rating:

| Rating | Gradient | Meaning |
|:------:|----------|---------|
| 7–10 | 🟢 Green | Strong / Positive |
| 4–6 | 🟡 Yellow | Neutral / Average |
| 1–3 | 🔴 Red | Weak / Negative |

- Smooth CSS transition when the result updates.
- Contrasting text color for readability.

---

## Technical Expectations

- Clean vanilla JavaScript — no external libraries.
- Integrate into the extension's existing UI and design token system.
- Lightweight, consistently styled components.
- Validate all inputs to prevent empty or invalid values.

---

## Goal

> A smooth user experience where users can quickly scroll through long pages and easily calculate a final anime rating from five category scores.
