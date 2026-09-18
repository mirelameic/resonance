export const DECADES = [
  { start: 1900, end: 1909, label: '1900s' },
  { start: 1910, end: 1919, label: '1910s' },
  { start: 1920, end: 1929, label: '1920s' },
  { start: 1930, end: 1939, label: '1930s' },
  { start: 1940, end: 1949, label: '1940s' },
  { start: 1950, end: 1959, label: '1950s' },
  { start: 1960, end: 1969, label: '1960s' },
  { start: 1970, end: 1979, label: '1970s' },
  { start: 1980, end: 1989, label: '1980s' },
  { start: 1990, end: 1999, label: '1990s' },
  { start: 2000, end: 2009, label: '2000s' },
  { start: 2010, end: 2019, label: '2010s' },
  { start: 2020, end: 2029, label: '2020s' },
];

export function decadeLabel(year) {
  return `${Math.floor(year / 10) * 10}s`;
}
