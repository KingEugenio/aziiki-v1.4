-- Keeps the Template Gallery's system-template descriptions in sync with
-- the redesigned DESIGN_TEMPLATES copy in InvoiceReceiptBuilder.tsx (each
-- description now names the specific border/shadow/totals treatment that
-- template actually renders, instead of generic styling language) - see
-- migration 0019 for the original seed and its layout_config bridge note.
update public.document_templates
set description = t.description
from (
  values
    (0, 'Formal corporate structure: bordered ledger table, boxed total, strict metadata columns.'),
    (1, 'Scandinavian white space: borderless table, hairline-underlined total, nothing shouting.'),
    (2, 'Solid colored sidebar strip and an inverted dark total block. Built for agencies.'),
    (3, 'Nerd-classic terminal ticket: dashed cutter borders, boxed total in a code-block frame.'),
    (4, 'Serif high-society heading, warm ivory shading, and a large underlined total figure.'),
    (5, 'Dot-matrix thermal-receipt coupon: dotted table rules, rounded pill total badge.'),
    (6, 'Imperial double-border frame, near-black table header, gold-on-navy total block.'),
    (7, 'Chubby rounded corners throughout, soft indigo tint, a big rounded total badge.'),
    (8, 'Vibrant borderless table, playful circular accents, a bright rounded total badge.'),
    (9, 'Heavy steel table partitions, bold ledger alignment, a thick-bordered boxed total.')
) as t(template_index, description)
where public.document_templates.is_system = true
  and public.document_templates.layout_config->>'templateIndex' = t.template_index::text;
