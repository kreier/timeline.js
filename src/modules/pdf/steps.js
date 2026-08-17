// One entry per drawing function called from create_timeline() in 6000.py,
// in the same order. `status` tracks the JS port's progress so the UI can be
// honest about what actually renders today vs. what's still a stub -
// flip an entry to "done" as you port the corresponding Python function.
//
// Phase 1 (this scaffold) ports the axis and the Adam-to-Moses block as a
// working example of the full pipeline: CSV -> layout math -> pdf-lib draw
// calls. Everything else is wired up (checkbox, ordering, docs) but is a
// documented no-op until its turn.

export const STEPS = [
  { id: 'axis',        label: 'Horizontal axis & century ticks', pyFn: 'create_horizontal_axis',  status: 'done',  default: true },
  { id: 'adamMoses',    label: 'Adam \u2192 Moses (patriarch boxes + Deluge line)', pyFn: 'create_adam_moses', status: 'done', default: true },
  { id: 'refEvents',    label: 'Reference events',                pyFn: 'create_reference_events', status: 'stub', default: true },
  { id: 'eventObjects', label: 'Events & objects (arrows)',        pyFn: 'create_events_objects',   status: 'stub', default: true },
  { id: 'judges',       label: 'Judges of Israel',                 pyFn: 'create_judges',           status: 'stub', default: true },
  { id: 'kings',        label: 'Kings of Israel & Judah',          pyFn: 'create_kings',            status: 'stub', default: true },
  { id: 'prophets',     label: 'Prophets',                         pyFn: 'create_prophets',         status: 'stub', default: true },
  { id: 'books',        label: 'Bible books',                      pyFn: 'create_books',            status: 'stub', default: true },
  { id: 'people',       label: 'Other historical people',          pyFn: 'create_people',           status: 'stub', default: true },
  { id: 'objects',      label: 'Objects / artifacts',              pyFn: 'create_objects',          status: 'stub', default: true },
  { id: 'periods',      label: 'Periods / empires / dynasties',    pyFn: 'create_periods',          status: 'stub', default: true },
  { id: 'caesars',      label: 'Roman Caesars',                    pyFn: 'create_caesars',          status: 'stub', default: true },
  { id: 'tribulation',  label: 'Great tribulation / time of the end', pyFn: 'create_tribulation',   status: 'stub', default: true },
  { id: 'terahFamily',  label: "Terah's family tree + footnotes",  pyFn: 'create_terah_familytree', status: 'stub', default: true },
  { id: 'pictures',     label: 'Raster images',                    pyFn: 'include_pictures',        status: 'stub', default: true },
  { id: 'picturesSvg',  label: 'SVG images (incl. world population)', pyFn: 'include_pictures_svg', status: 'stub', default: true },
  { id: 'daniel2',      label: 'Daniel 2 statue image',            pyFn: 'create_daniel2',          status: 'stub', default: true },
  { id: 'timestamp',    label: 'QR code, credits & timestamp',     pyFn: 'create_timestamp',        status: 'stub', default: true }
];
