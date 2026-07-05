export const SPORTS = [
  { type: 'surfen', label: 'Surfen', icon: '🏄' },
  { type: 'volleyball', label: 'Volleyball', icon: '🏐' },
  { type: 'mountainbiken', label: 'Mountainbiken', icon: '🚵' },
  { type: 'laufen', label: 'Laufen', icon: '🏃' },
  { type: 'schwimmen', label: 'Schwimmen', icon: '🏊' },
  { type: 'snowboarden', label: 'Snowboarden', icon: '🏂' },
];

export const CUSTOM_SPORT_ICON = '🔸';

export function getSportIcon(sportType) {
  return SPORTS.find(s => s.type === sportType)?.icon ?? CUSTOM_SPORT_ICON;
}
