-- The new drag-and-drop template editor (src/components/TemplateEditor.tsx)
-- saves user-built designs under a "Custom" category, which didn't exist in
-- the original curated category list from migration 0016.
alter table public.document_templates drop constraint document_templates_category_check;

alter table public.document_templates add constraint document_templates_category_check
  check (category in (
    'Corporate', 'Minimal', 'Luxury', 'Modern', 'Creative', 'African Inspired',
    'Fashion', 'Photography', 'Construction', 'Restaurant', 'Retail', 'Medical',
    'Legal', 'Technology', 'Education', 'Wholesale', 'Manufacturing',
    'Real Estate', 'Hospitality', 'Custom'
  ));
