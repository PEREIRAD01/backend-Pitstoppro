import prisma from '../db/prisma';

export type CreateTrackedItemInput = {
  name: string;
  itemType: 'event' | 'part';
  notes?: string | null;
  startDate?: Date | null;
  startOdometer?: number | null;
  validMonths?: number | null;
  validKm?: number | null;
  dueDate?: Date | null;
  dueOdometer?: number | null;
};

export type UpdateTrackedItemInput = Partial<{
  name: string;
  notes: string | null;
  validMonths: number | null;
  validKm: number | null;
  dueDate: Date | null;
  dueOdometer: number | null;
  isDone: boolean;
  doneDate: Date | null;
  doneOdometer: number | null;
}>;

export type CreateLogInput = {
  logDate: Date;
  odometerKm?: number | null;
  note?: string | null;
};

export async function findVehicleOwned(vehicleId: number, userId: number) {
  return prisma.vehicle.findFirst({ where: { id: vehicleId, userId }, select: { id: true } });
}

export async function listByVehicle(vehicleId: number, where: any) {
  return prisma.trackedItem.findMany({
    where: { vehicleId, ...where },
    orderBy: [{ isDone: 'asc' }, { dueDate: 'asc' }],
  });
}

export async function findOwnedItem(id: number) {
  return prisma.trackedItem.findFirst({ where: { id }, include: { vehicle: true } });
}

export async function createItem(vehicleId: number, data: CreateTrackedItemInput) {
  return prisma.trackedItem.create({ data: { vehicleId, ...data } });
}

export async function updateItemRecord(id: number, data: UpdateTrackedItemInput) {
  return prisma.trackedItem.update({ where: { id }, data });
}

export async function createLogRecord(trackedItemId: number, data: CreateLogInput) {
  return prisma.trackedItemLog.create({ data: { trackedItemId, ...data } });
}

export async function listLogsByItem(trackedItemId: number) {
  return prisma.trackedItemLog.findMany({ where: { trackedItemId }, orderBy: { logDate: 'desc' } });
}

