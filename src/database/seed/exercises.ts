import type { Equipment, Exercise, MuscleGroup, TrackingMode } from '@/types/domain';

/** Bump when the list below changes so installed apps re-seed their local library. */
export const SEED_VERSION = 1;
export const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

type M = MuscleGroup;
type E = Equipment;
type T = TrackingMode;

interface SeedTuple {
  name: string;
  primary: M;
  secondary: M[];
  equipment: E;
  mode: T;
  category: string;
  unilateral: boolean;
  aliases: string[];
}

const list: SeedTuple[] = [];

function x(
  name: string,
  primary: M,
  secondary: M[],
  equipment: E,
  category: string,
  opts: { mode?: T; uni?: boolean; aliases?: string[] } = {},
) {
  list.push({
    name,
    primary,
    secondary,
    equipment,
    mode: opts.mode ?? 'weight_reps',
    category,
    unilateral: opts.uni ?? false,
    aliases: opts.aliases ?? [],
  });
}

// ---------- CHEST ----------
x('Bench Press (Barbell)', 'chest', ['triceps', 'front_delts'], 'barbell', 'push', { aliases: ['Flat Bench', 'BB Bench Press'] });
x('Incline Bench Press (Barbell)', 'chest', ['front_delts', 'triceps'], 'barbell', 'push', { aliases: ['Incline Bench'] });
x('Decline Bench Press (Barbell)', 'chest', ['triceps'], 'barbell', 'push');
x('Close-Grip Bench Press', 'triceps', ['chest', 'front_delts'], 'barbell', 'push');
x('Bench Press (Dumbbell)', 'chest', ['triceps', 'front_delts'], 'dumbbell', 'push', { aliases: ['DB Bench Press'] });
x('Incline Bench Press (Dumbbell)', 'chest', ['front_delts', 'triceps'], 'dumbbell', 'push', { aliases: ['Incline Dumbbell Press', 'Incline DB Press'] });
x('Decline Bench Press (Dumbbell)', 'chest', ['triceps'], 'dumbbell', 'push');
x('Bench Press (Smith Machine)', 'chest', ['triceps', 'front_delts'], 'smith_machine', 'push');
x('Incline Bench Press (Smith Machine)', 'chest', ['front_delts', 'triceps'], 'smith_machine', 'push');
x('Chest Press (Machine)', 'chest', ['triceps', 'front_delts'], 'machine', 'push');
x('Incline Chest Press (Machine)', 'chest', ['front_delts', 'triceps'], 'machine', 'push');
x('Chest Fly (Dumbbell)', 'chest', ['front_delts'], 'dumbbell', 'isolation', { aliases: ['DB Fly'] });
x('Incline Chest Fly (Dumbbell)', 'chest', ['front_delts'], 'dumbbell', 'isolation');
x('Chest Fly (Cable)', 'chest', ['front_delts'], 'cable', 'isolation', { aliases: ['Cable Crossover'] });
x('Low Cable Fly', 'chest', ['front_delts'], 'cable', 'isolation');
x('High Cable Fly', 'chest', [], 'cable', 'isolation');
x('Pec Deck', 'chest', ['front_delts'], 'machine', 'isolation', { aliases: ['Machine Fly', 'Butterfly'] });
x('Push-Up', 'chest', ['triceps', 'front_delts', 'abs'], 'bodyweight', 'push', { mode: 'bodyweight_reps', aliases: ['Pushup'] });
x('Incline Push-Up', 'chest', ['triceps', 'front_delts'], 'bodyweight', 'push', { mode: 'bodyweight_reps' });
x('Decline Push-Up', 'chest', ['front_delts', 'triceps'], 'bodyweight', 'push', { mode: 'bodyweight_reps' });
x('Diamond Push-Up', 'triceps', ['chest'], 'bodyweight', 'push', { mode: 'bodyweight_reps' });
x('Chest Dip', 'chest', ['triceps', 'front_delts'], 'bodyweight', 'push', { mode: 'bodyweight_reps', aliases: ['Dips'] });
x('Assisted Dip', 'chest', ['triceps'], 'machine', 'push', { mode: 'assisted_bodyweight' });
x('Svend Press', 'chest', [], 'plate', 'isolation');
x('Landmine Press', 'front_delts', ['chest', 'triceps'], 'barbell', 'push', { uni: true });

// ---------- BACK ----------
x('Deadlift (Barbell)', 'lower_back', ['glutes', 'hamstrings', 'traps', 'forearms'], 'barbell', 'hinge', { aliases: ['Conventional Deadlift'] });
x('Sumo Deadlift', 'glutes', ['hamstrings', 'adductors', 'lower_back'], 'barbell', 'hinge');
x('Trap Bar Deadlift', 'quadriceps', ['glutes', 'hamstrings', 'lower_back', 'traps'], 'trap_bar', 'hinge');
x('Romanian Deadlift (Barbell)', 'hamstrings', ['glutes', 'lower_back'], 'barbell', 'hinge', { aliases: ['RDL'] });
x('Romanian Deadlift (Dumbbell)', 'hamstrings', ['glutes', 'lower_back'], 'dumbbell', 'hinge', { aliases: ['DB RDL'] });
x('Stiff-Leg Deadlift', 'hamstrings', ['glutes', 'lower_back'], 'barbell', 'hinge');
x('Rack Pull', 'upper_back', ['lower_back', 'traps', 'glutes'], 'barbell', 'hinge');
x('Pull-Up', 'lats', ['biceps', 'upper_back', 'forearms'], 'bodyweight', 'pull', { mode: 'bodyweight_reps', aliases: ['Pullup'] });
x('Chin-Up', 'lats', ['biceps', 'forearms'], 'bodyweight', 'pull', { mode: 'bodyweight_reps', aliases: ['Chinup'] });
x('Neutral Grip Pull-Up', 'lats', ['biceps', 'upper_back'], 'bodyweight', 'pull', { mode: 'bodyweight_reps' });
x('Assisted Pull-Up', 'lats', ['biceps', 'upper_back'], 'machine', 'pull', { mode: 'assisted_bodyweight' });
x('Assisted Chin-Up', 'lats', ['biceps'], 'machine', 'pull', { mode: 'assisted_bodyweight' });
x('Lat Pulldown (Cable)', 'lats', ['biceps', 'upper_back'], 'cable', 'pull', { aliases: ['Lat Pulldown'] });
x('Close-Grip Lat Pulldown', 'lats', ['biceps', 'upper_back'], 'cable', 'pull');
x('Single Arm Lat Pulldown', 'lats', ['biceps'], 'cable', 'pull', { uni: true });
x('Straight Arm Pulldown', 'lats', ['triceps'], 'cable', 'isolation');
x('Bent Over Row (Barbell)', 'upper_back', ['lats', 'biceps', 'rear_delts', 'lower_back'], 'barbell', 'pull', { aliases: ['Barbell Row', 'BB Row'] });
x('Pendlay Row', 'upper_back', ['lats', 'biceps', 'lower_back'], 'barbell', 'pull');
x('Yates Row', 'lats', ['upper_back', 'biceps'], 'barbell', 'pull');
x('Single Arm Row (Dumbbell)', 'lats', ['upper_back', 'biceps', 'rear_delts'], 'dumbbell', 'pull', { uni: true, aliases: ['One Arm Dumbbell Row'] });
x('Chest Supported Row (Dumbbell)', 'upper_back', ['lats', 'rear_delts', 'biceps'], 'dumbbell', 'pull');
x('T-Bar Row', 'upper_back', ['lats', 'biceps', 'rear_delts'], 'barbell', 'pull');
x('Seated Cable Row', 'upper_back', ['lats', 'biceps', 'rear_delts'], 'cable', 'pull');
x('Wide Grip Seated Cable Row', 'upper_back', ['rear_delts', 'lats'], 'cable', 'pull');
x('Row (Machine)', 'upper_back', ['lats', 'biceps', 'rear_delts'], 'machine', 'pull');
x('Chest Supported Row (Machine)', 'upper_back', ['lats', 'rear_delts', 'biceps'], 'machine', 'pull');
x('Inverted Row', 'upper_back', ['lats', 'biceps', 'rear_delts'], 'bodyweight', 'pull', { mode: 'bodyweight_reps', aliases: ['Bodyweight Row'] });
x('Meadows Row', 'lats', ['upper_back', 'biceps'], 'barbell', 'pull', { uni: true });
x('Seal Row', 'upper_back', ['lats', 'rear_delts'], 'barbell', 'pull');
x('Face Pull', 'rear_delts', ['upper_back', 'traps'], 'cable', 'pull');
x('Back Extension', 'lower_back', ['glutes', 'hamstrings'], 'bodyweight', 'hinge', { mode: 'bodyweight_reps', aliases: ['Hyperextension'] });
x('Weighted Back Extension', 'lower_back', ['glutes', 'hamstrings'], 'plate', 'hinge');
x('Good Morning', 'lower_back', ['hamstrings', 'glutes'], 'barbell', 'hinge');
x('Shrug (Barbell)', 'traps', ['forearms'], 'barbell', 'isolation');
x('Shrug (Dumbbell)', 'traps', ['forearms'], 'dumbbell', 'isolation');
x('Shrug (Smith Machine)', 'traps', [], 'smith_machine', 'isolation');
x('Dumbbell Pullover', 'lats', ['chest', 'triceps'], 'dumbbell', 'pull');

// ---------- SHOULDERS ----------
x('Overhead Press (Barbell)', 'front_delts', ['side_delts', 'triceps', 'upper_back'], 'barbell', 'push', { aliases: ['OHP', 'Military Press', 'Standing Press'] });
x('Seated Overhead Press (Barbell)', 'front_delts', ['side_delts', 'triceps'], 'barbell', 'push');
x('Shoulder Press (Dumbbell)', 'front_delts', ['side_delts', 'triceps'], 'dumbbell', 'push', { aliases: ['DB Shoulder Press'] });
x('Arnold Press', 'front_delts', ['side_delts', 'triceps'], 'dumbbell', 'push');
x('Shoulder Press (Machine)', 'front_delts', ['side_delts', 'triceps'], 'machine', 'push');
x('Shoulder Press (Smith Machine)', 'front_delts', ['side_delts', 'triceps'], 'smith_machine', 'push');
x('Push Press', 'front_delts', ['triceps', 'quadriceps'], 'barbell', 'push');
x('Lateral Raise (Dumbbell)', 'side_delts', [], 'dumbbell', 'isolation', { aliases: ['Side Raise', 'DB Lateral Raise'] });
x('Lateral Raise (Cable)', 'side_delts', [], 'cable', 'isolation', { uni: true });
x('Lateral Raise (Machine)', 'side_delts', [], 'machine', 'isolation');
x('Seated Lateral Raise (Dumbbell)', 'side_delts', [], 'dumbbell', 'isolation');
x('Front Raise (Dumbbell)', 'front_delts', [], 'dumbbell', 'isolation');
x('Front Raise (Cable)', 'front_delts', [], 'cable', 'isolation');
x('Plate Front Raise', 'front_delts', [], 'plate', 'isolation');
x('Rear Delt Fly (Dumbbell)', 'rear_delts', ['upper_back'], 'dumbbell', 'isolation', { aliases: ['Reverse Fly'] });
x('Reverse Pec Deck', 'rear_delts', ['upper_back'], 'machine', 'isolation', { aliases: ['Rear Delt Machine', 'Reverse Fly (Machine)'] });
x('Rear Delt Fly (Cable)', 'rear_delts', ['upper_back'], 'cable', 'isolation');
x('Upright Row (Barbell)', 'side_delts', ['traps', 'biceps'], 'barbell', 'pull');
x('Upright Row (Cable)', 'side_delts', ['traps'], 'cable', 'pull');
x('Pike Push-Up', 'front_delts', ['triceps', 'side_delts'], 'bodyweight', 'push', { mode: 'bodyweight_reps' });
x('Handstand Push-Up', 'front_delts', ['triceps', 'side_delts'], 'bodyweight', 'push', { mode: 'bodyweight_reps', aliases: ['HSPU'] });

// ---------- BICEPS ----------
x('Bicep Curl (Barbell)', 'biceps', ['forearms'], 'barbell', 'isolation', { aliases: ['Barbell Curl', 'BB Curl'] });
x('Bicep Curl (EZ Bar)', 'biceps', ['forearms'], 'ez_bar', 'isolation', { aliases: ['EZ Bar Curl'] });
x('Bicep Curl (Dumbbell)', 'biceps', ['forearms'], 'dumbbell', 'isolation', { aliases: ['DB Curl', 'Dumbbell Curl'] });
x('Alternating Dumbbell Curl', 'biceps', ['forearms'], 'dumbbell', 'isolation', { uni: true });
x('Hammer Curl (Dumbbell)', 'biceps', ['forearms'], 'dumbbell', 'isolation');
x('Cross Body Hammer Curl', 'biceps', ['forearms'], 'dumbbell', 'isolation', { uni: true });
x('Incline Dumbbell Curl', 'biceps', [], 'dumbbell', 'isolation');
x('Preacher Curl (EZ Bar)', 'biceps', [], 'ez_bar', 'isolation');
x('Preacher Curl (Dumbbell)', 'biceps', [], 'dumbbell', 'isolation', { uni: true });
x('Preacher Curl (Machine)', 'biceps', [], 'machine', 'isolation');
x('Concentration Curl', 'biceps', [], 'dumbbell', 'isolation', { uni: true });
x('Spider Curl', 'biceps', [], 'ez_bar', 'isolation');
x('Bicep Curl (Cable)', 'biceps', ['forearms'], 'cable', 'isolation');
x('Hammer Curl (Cable Rope)', 'biceps', ['forearms'], 'cable', 'isolation');
x('Bayesian Curl (Cable)', 'biceps', [], 'cable', 'isolation', { uni: true });
x('Zottman Curl', 'biceps', ['forearms'], 'dumbbell', 'isolation');
x('Reverse Curl (EZ Bar)', 'forearms', ['biceps'], 'ez_bar', 'isolation');

// ---------- TRICEPS ----------
x('Triceps Pushdown (Cable)', 'triceps', [], 'cable', 'isolation', { aliases: ['Tricep Pushdown'] });
x('Triceps Rope Pushdown', 'triceps', [], 'cable', 'isolation', { aliases: ['Rope Pushdown'] });
x('Reverse Grip Pushdown', 'triceps', ['forearms'], 'cable', 'isolation');
x('Overhead Triceps Extension (Cable)', 'triceps', [], 'cable', 'isolation');
x('Overhead Triceps Extension (Dumbbell)', 'triceps', [], 'dumbbell', 'isolation');
x('Skullcrusher (EZ Bar)', 'triceps', [], 'ez_bar', 'isolation', { aliases: ['Lying Triceps Extension'] });
x('Skullcrusher (Dumbbell)', 'triceps', [], 'dumbbell', 'isolation');
x('Triceps Kickback (Dumbbell)', 'triceps', [], 'dumbbell', 'isolation', { uni: true });
x('Triceps Dip', 'triceps', ['chest', 'front_delts'], 'bodyweight', 'push', { mode: 'bodyweight_reps' });
x('Bench Dip', 'triceps', ['chest'], 'bench', 'push', { mode: 'bodyweight_reps' });
x('Triceps Extension (Machine)', 'triceps', [], 'machine', 'isolation');
x('JM Press', 'triceps', ['chest'], 'barbell', 'push');

// ---------- LEGS ----------
x('Squat (Barbell)', 'quadriceps', ['glutes', 'adductors', 'lower_back', 'hamstrings'], 'barbell', 'squat', { aliases: ['Back Squat', 'BB Squat'] });
x('Front Squat (Barbell)', 'quadriceps', ['glutes', 'abs', 'upper_back'], 'barbell', 'squat');
x('Box Squat', 'quadriceps', ['glutes', 'hamstrings'], 'barbell', 'squat');
x('Squat (Smith Machine)', 'quadriceps', ['glutes'], 'smith_machine', 'squat');
x('Goblet Squat', 'quadriceps', ['glutes', 'abs'], 'dumbbell', 'squat', { aliases: ['Dumbbell Goblet Squat'] });
x('Hack Squat (Machine)', 'quadriceps', ['glutes'], 'machine', 'squat', { aliases: ['Hack Squat'] });
x('Leg Press', 'quadriceps', ['glutes', 'hamstrings', 'adductors'], 'machine', 'squat', { aliases: ['Sled Leg Press'] });
x('Single Leg Press', 'quadriceps', ['glutes'], 'machine', 'squat', { uni: true });
x('Pendulum Squat', 'quadriceps', ['glutes'], 'machine', 'squat');
x('Bodyweight Squat', 'quadriceps', ['glutes'], 'bodyweight', 'squat', { mode: 'bodyweight_reps', aliases: ['Air Squat'] });
x('Bulgarian Split Squat (Dumbbell)', 'quadriceps', ['glutes', 'adductors'], 'dumbbell', 'lunge', { uni: true, aliases: ['Bulgarian Split Squat'] });
x('Split Squat (Dumbbell)', 'quadriceps', ['glutes'], 'dumbbell', 'lunge', { uni: true });
x('Walking Lunge (Dumbbell)', 'quadriceps', ['glutes', 'hamstrings'], 'dumbbell', 'lunge', { aliases: ['Walking Lunges'] });
x('Reverse Lunge (Dumbbell)', 'quadriceps', ['glutes', 'hamstrings'], 'dumbbell', 'lunge', { uni: true });
x('Lunge (Barbell)', 'quadriceps', ['glutes', 'hamstrings'], 'barbell', 'lunge');
x('Step-Up (Dumbbell)', 'quadriceps', ['glutes'], 'dumbbell', 'lunge', { uni: true });
x('Leg Extension (Machine)', 'quadriceps', [], 'machine', 'isolation', { aliases: ['Leg Extension'] });
x('Seated Leg Curl (Machine)', 'hamstrings', ['calves'], 'machine', 'isolation', { aliases: ['Hamstring Curl'] });
x('Lying Leg Curl (Machine)', 'hamstrings', ['calves'], 'machine', 'isolation');
x('Nordic Hamstring Curl', 'hamstrings', ['glutes'], 'bodyweight', 'isolation', { mode: 'bodyweight_reps' });
x('Hip Thrust (Barbell)', 'glutes', ['hamstrings', 'adductors'], 'barbell', 'hinge', { aliases: ['Barbell Hip Thrust'] });
x('Hip Thrust (Machine)', 'glutes', ['hamstrings'], 'machine', 'hinge');
x('Glute Bridge', 'glutes', ['hamstrings'], 'bodyweight', 'hinge', { mode: 'bodyweight_reps' });
x('Cable Pull Through', 'glutes', ['hamstrings', 'lower_back'], 'cable', 'hinge');
x('Kettlebell Swing', 'glutes', ['hamstrings', 'lower_back', 'front_delts'], 'kettlebell', 'hinge');
x('Glute Kickback (Cable)', 'glutes', ['hamstrings'], 'cable', 'isolation', { uni: true });
x('Glute Kickback (Machine)', 'glutes', [], 'machine', 'isolation', { uni: true });
x('Hip Abduction (Machine)', 'abductors', ['glutes'], 'machine', 'isolation');
x('Hip Adduction (Machine)', 'adductors', [], 'machine', 'isolation');
x('Standing Calf Raise (Machine)', 'calves', [], 'machine', 'isolation', { aliases: ['Calf Raise'] });
x('Standing Calf Raise (Smith Machine)', 'calves', [], 'smith_machine', 'isolation');
x('Seated Calf Raise (Machine)', 'calves', [], 'machine', 'isolation');
x('Calf Press (Leg Press)', 'calves', [], 'machine', 'isolation');
x('Single Leg Calf Raise', 'calves', [], 'bodyweight', 'isolation', { mode: 'bodyweight_reps', uni: true });
x('Sissy Squat', 'quadriceps', [], 'bodyweight', 'squat', { mode: 'bodyweight_reps' });
x('Jump Squat', 'quadriceps', ['glutes', 'calves'], 'bodyweight', 'squat', { mode: 'bodyweight_reps' });
x('Box Jump', 'quadriceps', ['glutes', 'calves'], 'other', 'plyometric', { mode: 'reps_only' });
x('Wall Sit', 'quadriceps', ['glutes'], 'bodyweight', 'squat', { mode: 'duration' });

// ---------- CORE ----------
x('Plank', 'abs', ['obliques', 'lower_back'], 'bodyweight', 'core', { mode: 'duration' });
x('Weighted Plank', 'abs', ['obliques'], 'plate', 'core', { mode: 'time_weight' });
x('Side Plank', 'obliques', ['abs'], 'bodyweight', 'core', { mode: 'duration', uni: true });
x('Crunch', 'abs', [], 'bodyweight', 'core', { mode: 'reps_only' });
x('Cable Crunch', 'abs', [], 'cable', 'core');
x('Machine Crunch', 'abs', [], 'machine', 'core');
x('Decline Sit-Up', 'abs', [], 'bench', 'core', { mode: 'bodyweight_reps' });
x('Sit-Up', 'abs', [], 'bodyweight', 'core', { mode: 'reps_only' });
x('Hanging Leg Raise', 'abs', ['forearms'], 'bodyweight', 'core', { mode: 'reps_only' });
x('Hanging Knee Raise', 'abs', ['forearms'], 'bodyweight', 'core', { mode: 'reps_only' });
x('Captain\'s Chair Leg Raise', 'abs', [], 'machine', 'core', { mode: 'reps_only' });
x('Lying Leg Raise', 'abs', [], 'bodyweight', 'core', { mode: 'reps_only' });
x('Ab Wheel Rollout', 'abs', ['lats', 'front_delts'], 'other', 'core', { mode: 'reps_only' });
x('Russian Twist', 'obliques', ['abs'], 'bodyweight', 'core', { mode: 'bodyweight_reps' });
x('Cable Woodchopper', 'obliques', ['abs'], 'cable', 'core', { uni: true });
x('Pallof Press', 'obliques', ['abs'], 'cable', 'core', { uni: true });
x('Bicycle Crunch', 'obliques', ['abs'], 'bodyweight', 'core', { mode: 'reps_only' });
x('Mountain Climber', 'abs', ['front_delts'], 'bodyweight', 'core', { mode: 'reps_only' });
x('Dead Bug', 'abs', [], 'bodyweight', 'core', { mode: 'reps_only' });
x('Hollow Hold', 'abs', [], 'bodyweight', 'core', { mode: 'duration' });
x('Dragon Flag', 'abs', [], 'bench', 'core', { mode: 'reps_only' });
x('Suitcase Carry', 'obliques', ['forearms', 'traps'], 'dumbbell', 'carry', { mode: 'distance_weight', uni: true });

// ---------- FOREARMS / CARRIES ----------
x('Wrist Curl (Barbell)', 'forearms', [], 'barbell', 'isolation');
x('Reverse Wrist Curl', 'forearms', [], 'barbell', 'isolation');
x('Farmer\'s Walk', 'forearms', ['traps', 'abs', 'glutes'], 'dumbbell', 'carry', { mode: 'distance_weight', aliases: ['Farmers Carry'] });
x('Farmer\'s Hold', 'forearms', ['traps'], 'dumbbell', 'carry', { mode: 'time_weight' });
x('Dead Hang', 'forearms', ['lats'], 'bodyweight', 'hold', { mode: 'duration' });
x('Plate Pinch', 'forearms', [], 'plate', 'hold', { mode: 'time_weight' });
x('Sled Push', 'quadriceps', ['glutes', 'calves'], 'other', 'carry', { mode: 'distance_weight' });
x('Sled Pull', 'hamstrings', ['glutes', 'calves'], 'other', 'carry', { mode: 'distance_weight' });

// ---------- OLYMPIC / FULL BODY ----------
x('Power Clean', 'full_body', ['traps', 'glutes', 'quadriceps'], 'barbell', 'olympic');
x('Hang Clean', 'full_body', ['traps', 'glutes'], 'barbell', 'olympic');
x('Clean and Jerk', 'full_body', ['front_delts', 'quadriceps'], 'barbell', 'olympic');
x('Snatch', 'full_body', ['traps', 'front_delts'], 'barbell', 'olympic');
x('Thruster (Barbell)', 'full_body', ['quadriceps', 'front_delts'], 'barbell', 'squat');
x('Kettlebell Turkish Get-Up', 'full_body', ['abs', 'front_delts'], 'kettlebell', 'other', { uni: true });
x('Burpee', 'full_body', ['chest', 'quadriceps'], 'bodyweight', 'conditioning', { mode: 'reps_only' });
x('Battle Ropes', 'full_body', ['front_delts'], 'other', 'conditioning', { mode: 'duration' });
x('Medicine Ball Slam', 'full_body', ['abs', 'lats'], 'other', 'conditioning', { mode: 'reps_only' });

// ---------- CARDIO ----------
x('Running (Outdoor)', 'cardio', ['quadriceps', 'calves', 'hamstrings'], 'bodyweight', 'cardio', { mode: 'distance_duration', aliases: ['Run', 'Jogging'] });
x('Running (Treadmill)', 'cardio', ['quadriceps', 'calves', 'hamstrings'], 'cardio_machine', 'cardio', { mode: 'distance_duration', aliases: ['Treadmill'] });
x('Incline Walk (Treadmill)', 'cardio', ['glutes', 'calves'], 'cardio_machine', 'cardio', { mode: 'distance_duration' });
x('Walking', 'cardio', ['calves'], 'bodyweight', 'cardio', { mode: 'distance_duration', aliases: ['Walk'] });
x('Cycling (Outdoor)', 'cardio', ['quadriceps', 'glutes'], 'other', 'cardio', { mode: 'distance_duration', aliases: ['Bike'] });
x('Cycling (Stationary)', 'cardio', ['quadriceps', 'glutes'], 'cardio_machine', 'cardio', { mode: 'distance_duration', aliases: ['Exercise Bike', 'Spin Bike'] });
x('Rowing (Machine)', 'cardio', ['lats', 'upper_back', 'quadriceps'], 'cardio_machine', 'cardio', { mode: 'distance_duration', aliases: ['Erg', 'Rower'] });
x('Elliptical', 'cardio', ['quadriceps', 'glutes'], 'cardio_machine', 'cardio', { mode: 'distance_duration' });
x('Stair Climber', 'cardio', ['glutes', 'quadriceps', 'calves'], 'cardio_machine', 'cardio', { mode: 'duration', aliases: ['Stairmaster'] });
x('Ski Erg', 'cardio', ['lats', 'triceps', 'abs'], 'cardio_machine', 'cardio', { mode: 'distance_duration' });
x('Air Bike', 'cardio', ['quadriceps', 'front_delts'], 'cardio_machine', 'cardio', { mode: 'distance_duration', aliases: ['Assault Bike'] });
x('Swimming', 'cardio', ['lats', 'front_delts'], 'other', 'cardio', { mode: 'distance_duration' });
x('Jump Rope', 'cardio', ['calves'], 'other', 'cardio', { mode: 'duration', aliases: ['Skipping'] });
x('Hiking', 'cardio', ['quadriceps', 'glutes', 'calves'], 'bodyweight', 'cardio', { mode: 'distance_duration' });

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const SYSTEM_EXERCISES: Exercise[] = list.map((s) => ({
  id: `sys_${slugify(s.name)}`,
  user_id: null,
  name: s.name,
  aliases: s.aliases,
  tracking_mode: s.mode,
  primary_muscle: s.primary,
  secondary_muscles: s.secondary,
  equipment: s.equipment,
  movement_category: s.category,
  instructions: '',
  personal_notes: '',
  is_system: true,
  is_unilateral: s.unilateral,
  custom_fields: [],
  created_at: SEED_TIMESTAMP,
  updated_at: SEED_TIMESTAMP,
  deleted_at: null,
  sync_status: 'synced' as const,
}));
