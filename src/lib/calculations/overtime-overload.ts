export function overtimeMinutesToHours(minutes: number) {
  return Number((Math.max(0, minutes) / 60).toFixed(3));
}

export function computeWeeklyOverload(totalTeachingHours: number, regularTeachingLoadHours: number) {
  return Number(Math.max(0, totalTeachingHours - regularTeachingLoadHours).toFixed(3));
}
