// Step definitions mapping directly to drawing functions in 6000.py.
// All 18 steps are now implemented.

export const STEPS = [
  { id: 'axis',         label: 'Horizontal axis & century ticks',      pyFn: 'create_horizontal_axis',   status: 'done', default: true },
  { id: 'adamMoses',    label: 'Adam \u2192 Moses (patriarchs & Deluge)', pyFn: 'create_adam_moses',        status: 'done', default: true },
  { id: 'refEvents',    label: 'Reference events',                     pyFn: 'create_reference_events',  status: 'done', default: true },
  { id: 'eventObjects', label: 'Events & objects (arrows)',             pyFn: 'create_events_objects',    status: 'done', default: true },
  { id: 'judges',       label: 'Judges of Israel',                      pyFn: 'create_judges',            status: 'done', default: true },
  { id: 'kings',        label: 'Kings of Israel & Judah',               pyFn: 'create_kings',             status: 'done', default: true },
  { id: 'prophets',     label: 'Prophets',                              pyFn: 'create_prophets',          status: 'done', default: true },
  { id: 'books',        label: 'Bible books',                           pyFn: 'create_books',             status: 'done', default: true },
  { id: 'people',       label: 'Other historical people',               pyFn: 'create_people',            status: 'done', default: true },
  { id: 'objects',      label: 'Objects / artifacts',                   pyFn: 'create_objects',           status: 'done', default: true },
  { id: 'periods',      label: 'Periods / empires / dynasties',         pyFn: 'create_periods',           status: 'done', default: true },
  { id: 'caesars',      label: 'Roman Caesars',                         pyFn: 'create_caesars',           status: 'done', default: true },
  { id: 'tribulation',  label: 'Great tribulation / time of the end',  pyFn: 'create_tribulation',        status: 'done', default: true },
  { id: 'terahFamily',  label: "Terah's family tree + footnotes",       pyFn: 'create_terah_familytree',  status: 'done', default: true },
  { id: 'pictures',     label: 'Raster images (photos & artifacts)',    pyFn: 'include_pictures',         status: 'done', default: true },
  { id: 'picturesSvg',  label: 'SVG graphics & World Population',       pyFn: 'include_pictures_svg',     status: 'done', default: true },
  { id: 'daniel2',      label: 'Daniel 2 statue & world powers',        pyFn: 'create_daniel2',           status: 'done', default: true },
  { id: 'timestamp',    label: 'QR code, credits & timestamp',          pyFn: 'create_timestamp',         status: 'done', default: true }
];
