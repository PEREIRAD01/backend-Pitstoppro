import { AppError } from '../errors';
import { createVehicle as repoCreateVehicle, existsPlateForUser, findByIdForUser, updateVehicleRecord, CreateVehicleInput, listVehiclesForUser, deleteVehicleRecord } from '../repos/vehicle-repo';

export async function createVehicle(userId: number, data: CreateVehicleInput) {
  const duplicate = await existsPlateForUser(userId, data.plate);
  if (duplicate) throw new AppError('Vehicle with this plate already exists', 409);
  const created = await repoCreateVehicle(userId, data);
  return { id: created.id };
}

export async function updateVehicle(userId: number, id: number, data: Partial<CreateVehicleInput>) {
  const vehicle = await findByIdForUser(id, userId);
  if (!vehicle) throw new AppError('Not found', 404);

  if (data.plate && data.plate !== vehicle.plate) {
    const conflict = await existsPlateForUser(userId, data.plate, id);
    if (conflict) throw new AppError('Vehicle with this plate already exists', 409);
  }

  const updated = await updateVehicleRecord(id, data);
  return { id: updated.id };
}

export async function listVehicles(
  userId: number,
  opts: { page: number; limit: number; sortField: 'id' | 'plate' | 'brand' | 'model'; sortDir: 'asc' | 'desc' },
) {
  const { data, total } = await listVehiclesForUser(userId, opts);
  const pages = Math.ceil(total / opts.limit);
  return { data, page: opts.page, limit: opts.limit, total, pages };
}

export async function deleteVehicle(userId: number, id: number) {
  const vehicle = await findByIdForUser(id, userId);
  if (!vehicle) throw new AppError('Not found', 404);
  await deleteVehicleRecord(id);
}
