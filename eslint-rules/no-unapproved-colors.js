/**
 * ESLint rule: design-system/no-unapproved-colors
 *
 * Prevents any hex color literal that isn't in the approved design token set.
 * Runs in IDE (real-time feedback) and CI (blocks merges).
 */

const APPROVED_HEX = new Set([
  // Light mode
  '#FFFFFF', '#F8FAFC', '#F1F5F9', '#0F172A', '#334155', '#475569',
  '#5B21B6', '#115E59', '#065F46', '#991B1B', '#CBD5E1',
  // Dark mode
  '#1E293B', '#A9B5BF', '#C4B5FD', '#67E8F9', '#6EE7B7', '#FCA5A5',
  // Aurora (shared with light)
  '#0E7490',
  // Also allow common neutrals that appear in borders/hover
  '#64748B',
  // Google brand SVG colors (required by brand guidelines)
  '#4285F4', '#34A853', '#FBBC05', '#EA4335',
]);

// Also allow lowercase versions
const APPROVED_NORMALIZED = new Set(
  [...APPROVED_HEX].flatMap((c) => [c, c.toLowerCase()])
);

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hex color values not in the approved design token set',
      category: 'Design System',
    },
    messages: {
      unapprovedColor:
        'Color "{{color}}" is not in DESIGN_TOKENS. Use a Tailwind semantic class or add it to the design system (with AAA verification).',
    },
    schema: [],
  },
  create(context) {
    function checkForColors(node, value) {
      if (typeof value !== 'string') return;
      const hexMatches = value.match(/#[0-9a-fA-F]{6}/g);
      if (!hexMatches) return;

      hexMatches.forEach((color) => {
        if (!APPROVED_NORMALIZED.has(color) && !APPROVED_NORMALIZED.has(color.toUpperCase())) {
          context.report({
            node,
            messageId: 'unapprovedColor',
            data: { color },
          });
        }
      });
    }

    return {
      Literal(node) {
        checkForColors(node, node.value);
      },
      TemplateLiteral(node) {
        node.quasis.forEach((quasi) => {
          checkForColors(quasi, quasi.value.raw);
        });
      },
    };
  },
};
