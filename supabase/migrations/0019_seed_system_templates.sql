-- Seeds the Template Gallery with FOFU's existing 10 hand-built visual
-- designs (previously only available as a hardcoded array inside
-- InvoiceReceiptBuilder.tsx) so the gallery has real, non-fabricated
-- content from day one instead of empty categories.
--
-- BRIDGE NOTE: layout_config here only carries {"templateIndex": N} - a
-- pointer back into the existing local DESIGN_TEMPLATES array in
-- InvoiceReceiptBuilder.tsx, not a full block-based layout definition.
-- That's deliberate: rewriting the renderer to consume an arbitrary
-- layout_config is the drag-and-drop editor work itself (see the roadmap),
-- and isn't done here. This bridge lets the gallery, favoriting, and
-- "set as default template" all work for real today against the designs
-- that already exist, without a half-built JSON rendering engine underneath
-- them.
insert into public.document_templates (name, description, document_type, category, layout_config, is_system)
select t.name, t.description, d.document_type, t.category,
       jsonb_build_object('templateIndex', t.template_index, 'bridge', 'legacy-local-template'),
       true
from (
  values
    (0, 'Classic Emerald Professional', 'Standard corporate structure, formal metadata columns, and strict borders.', 'Corporate'),
    (1, 'Modern Minimalist Slate', 'Generous typography negative space, neat borderless items grid and deep slate tones.', 'Minimal'),
    (2, 'Executive Emerald Left-Strip', 'Solid, elegant, colored band on the left margin. Perfect for corporate agencies.', 'Corporate'),
    (3, 'Retro Carbon Monospaced', 'A compact nerd-classic terminal layout with dashed invoice cutters and monospaced codes.', 'Technology'),
    (4, 'Editorial Bookman Traditional', 'Elegant serif typeface detailing, warm ivory shading, and refined high-society headings.', 'Legal'),
    (5, 'Retail Ticket Coupon', 'Boxed coupon structure resembling a dot-matrix thermal output with compact columns.', 'Retail'),
    (6, 'Sovereign Gold Double-Border', 'Thin imperial double border contours, golden-shimmer values, and royal headers.', 'Luxury'),
    (7, 'Urban Futuristic Rounded', 'Chubby rounded corners layout, soft canvas shading, and comfortable responsive metrics.', 'Modern'),
    (8, 'Creative Sky Highlight Bubble', 'Vibrant high-contrast layout emphasizing soft circular badges and colored background accents.', 'Creative'),
    (9, 'Ecosystem Industrial Grid', 'Bold ledger alignment, clear compliance indicators, and heavy steel table partitions.', 'Manufacturing')
) as t(template_index, name, description, category)
cross join (values ('invoice'), ('receipt'), ('quotation')) as d(document_type);
