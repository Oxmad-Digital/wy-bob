import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { findUserByEmail, listUserAddresses } from "@/app/lib/repos/users";
import AddressesClient from "../components/AddressesClient";

export default async function AddressesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const user = await findUserByEmail(session.user.email);
  const userAddresses: any[] = user ? await listUserAddresses(user.id) : [];

  const addresses = userAddresses.map((a: any) => ({
    label:    a.label    ?? "",
    fullName: a.fullName ?? "",
    street:   a.street   ?? "",
    zip:      a.zip      ?? "",
    city:     a.city     ?? "",
    country:  a.country  ?? "",
  }));

  return <AddressesClient initialAddresses={addresses} />;
}
