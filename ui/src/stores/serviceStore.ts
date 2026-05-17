// @module:billing
import { atom } from "nanostores";
import type { ServiceItem } from "../domain/types";
import {
  loadServices,
  upsertService,
  deleteService as dbDeleteService,
} from "../lib/db";
import { $bridgeServices } from "./coreBridge";

export const $services = atom<ServiceItem[]>(loadServices());
$services.subscribe(val => $bridgeServices.set(val as ServiceItem[]));

export function initServices(): void {
  $services.set(loadServices());
}

export function addService(
  draft: Omit<ServiceItem, "id" | "createdAt">,
): ServiceItem {
  const item: ServiceItem = {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  $services.set(upsertService(item));
  return item;
}

export function updateService(
  id: string,
  patch: Partial<Omit<ServiceItem, "id" | "createdAt">>,
): void {
  const item = $services.get().find((s) => s.id === id);
  if (!item) return;
  $services.set(upsertService({ ...item, ...patch }));
}

export function removeService(id: string): void {
  $services.set(dbDeleteService(id));
}