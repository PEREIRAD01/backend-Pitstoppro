import prisma from '../db/prisma';

export type CreateVehicleInput = {
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  vehicleName?: string | null;
  currentOdometerKm?: number | null;
};

export async function existsPlateForUser(userId: number, plate: string, excludeId?: number): Promise<boolean> {
  const where: any = excludeId
    ? { userId, plate, NOT: { id: excludeId } }
    : { userId, plate };
  const found = await prisma.vehicle.findFirst({ where, select: { id: true } });
  return Boolean(found);
}

export async function createVehicle(userId: number, data: CreateVehicleInput) {
  return prisma.vehicle.create({ data: { ...data, userId } });
}

export async function findByIdForUser(id: number, userId: number) {
  return prisma.vehicle.findFirst({ where: { id, userId } });
}

export async function updateVehicleRecord(id: number, data: Partial<CreateVehicleInput>) {
  return prisma.vehicle.update({ where: { id }, data });
}

export async function listVehiclesForUser(
  userId: number,
  opts: { page: number; limit: number; sortField: 'id' | 'plate' | 'brand' | 'model'; sortDir: 'asc' | 'desc' },
) {
  const { page, limit, sortField, sortDir } = opts;
  const [data, total] = await Promise.all([
    prisma.vehicle.findMany({
      where: { userId },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        vehicleName: true,
        currentOdometerKm: true,
      },
      orderBy: { [sortField]: sortDir } as any,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vehicle.count({ where: { userId } }),
  ]);
  return { data, total };
}

export async function deleteVehicleRecord(id: number) {
  await prisma.vehicle.delete({ where: { id } });
}
