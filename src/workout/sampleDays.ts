import type { Exercise } from './ExerciseLibrary'

type Day = { id?: string; name: string; subtitle: string; exercises: Exercise[] }

export const sampleDays: Day[] = [
  { name: 'Push', subtitle: 'Chest, shoulders & triceps', exercises: [
    { name: 'Chest press', equipment: 'Chest press machine', sets: '30 kg · 12 / 10 / 8', note: 'Seat 4 · Side grip' },
    { name: 'Shoulder press', equipment: 'Shoulder press machine', sets: '20 kg · 12 / 10 / 8', note: 'Keep shoulders relaxed' },
    { name: 'Chest fly', equipment: 'Pec deck machine', sets: '25 kg · 12 / 10 / 8' },
    { name: 'Tricep pushdown', equipment: 'Cable machine', sets: '20 kg · 12 / 10 / 8', alternatives: ['Overhead tricep extension', 'Seated tricep press'] },
    { name: 'Lateral raises', equipment: 'Dumbbells', sets: '5 kg · 12 / 10 / 8' },
  ]},
  { name: 'Pull', subtitle: 'Back, biceps & rear delts', exercises: [
    { name: 'Seated row', equipment: 'Row machine', sets: '30 kg · 12 / 10 / 8' }, { name: 'Lat pulldown', equipment: 'Cable machine', sets: '25 kg · 12 / 10 / 8' }, { name: 'Shrugs', equipment: 'Dumbbells', sets: '10 kg · 12 / 10 / 8' }, { name: 'Hammer curls', equipment: 'Dumbbells', sets: '6 kg · 12 / 10 / 8', alternatives: ['Bicep curls'] }, { name: 'Rear delt fly', equipment: 'Pec deck machine', sets: '15 kg · 12 / 10 / 8' },
  ]},
  { name: 'Accessories', subtitle: 'Arms, core & cardio', exercises: [
    { name: 'Overhead tricep extension', equipment: 'Cable machine', sets: '15 kg · 12 / 10 / 8' }, { name: 'Bicep curls', equipment: 'Dumbbells', sets: '6 kg · 12 / 10 / 8' }, { name: 'Lower back extension', equipment: 'Lower back machine', sets: '25 kg · 12 / 10 / 8' }, { name: 'Weighted crunches', equipment: 'Crunch machine', sets: '20 kg · 12 / 10 / 8' }, { name: 'Incline treadmill walk', equipment: 'Treadmill', sets: '5 km/h · 8° · 20 min', note: '2 min ramp-up and cooldown' },
  ]},
  { name: 'Legs', subtitle: 'Quads, glutes & hamstrings', exercises: [
    { name: 'Leg press', equipment: 'Leg press machine', sets: '60 kg · 12 / 10 / 8' }, { name: 'Leg extension', equipment: 'Leg extension machine', sets: '30 kg · 12 / 10 / 8' }, { name: 'Hamstring curls', equipment: 'Leg curl machine', sets: '25 kg · 12 / 10 / 8' }, { name: 'Hip abduction', equipment: 'Hip machine', sets: '30 kg · 12 / 10 / 8', alternatives: ['Hip adduction'] }, { name: 'Hip thrust', equipment: 'Hip thrust machine', sets: '30 kg · 12 / 10 / 8' }, { name: 'Calf raises', equipment: 'Calf raise machine', sets: '30 kg · 12 / 10 / 8' },
  ]},
]
