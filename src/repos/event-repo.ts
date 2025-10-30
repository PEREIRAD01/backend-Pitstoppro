import prisma from '../db/prisma';

export type CreateEventInput = {
  eventType: 'insurance' | 'inspection' | 'iuc' | 'custom';
  dueDate: Date;
  note?: string | null;
};

export type UpdateEventInput = Partial<{
  isDone: boolean;
  doneDate: Date | null;
  note: string | null;
}>;

export async function findVehicleOwned(vehicleId: number, userId: number) {
  return prisma.vehicle.findFirst({ where: { id: vehicleId, userId }, select: { id: true } });
}

export async function listEventsByVehicle(
  vehicleId: number,
  where: any,
) {
  return prisma.vehicleEvent.findMany({ where: { vehicleId, ...where }, orderBy: { dueDate: 'asc' } });
}

export async function findOwnedEvent(eventId: number, userId: number) {
  return prisma.vehicleEvent.findFirst({ where: { id: eventId }, include: { vehicle: true } });
}

export async function createEvent(vehicleId: number, data: CreateEventInput) {
  return prisma.vehicleEvent.create({ data: { vehicleId, ...data } });
}

export async function updateEventRecord(eventId: number, data: UpdateEventInput) {
  return prisma.vehicleEvent.update({ where: { id: eventId }, data });
}

