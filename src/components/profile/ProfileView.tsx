"use client";
// Lucas · F3 — HU10 Editar perfil, HU11 Configurar 2FA (MFA de Auth0),
// HU12 Cambiar contraseña (correo de Auth0). Diseño Figma "perfil".
import { useCallback, useState } from "react";
import { BadgeCheck, Camera, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/hooks/useAuth";
import { useHouseholds } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { TextField } from "@/components/ui/Field";
import { Auth0Link } from "@/components/auth/Auth0Screens";
import { validateProfile, type ProfileInput } from "@/lib/domain/profile";
import { readFileAsDataUrl } from "@/lib/utils";
import type { User } from "@/types";

function PersonalData({ user }: { user: User }) {
  const { dict } = useI18n();
  const { updateProfile } = useAuth();
  const { notify } = useToast();
  const validate = useCallback((v: ProfileInput) => validateProfile(v), []);
  const form = useForm<ProfileInput>({
    initialValues: { name: user.name, phone: user.phone },
    validate,
    onSubmit: (values) => {
      updateProfile({ name: values.name.trim(), phone: values.phone.trim() });
      notify(dict.profile.saved);
    },
  });

  return (
    <Card tone="container" aria-labelledby="personal-data" className="flex flex-col gap-6">
      <h2 id="personal-data" className="flex items-center gap-3 text-xl font-bold">
        <UserRound aria-hidden="true" className="size-5" /> {dict.profile.personalData}
      </h2>
      <form noValidate onSubmit={form.handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TextField label={dict.profile.fields.name} autoComplete="name" required {...form.field("name")} />
        <TextField label={dict.profile.fields.email} type="email" value={user.email} disabled hint={dict.auth0.emailManaged} readOnly />
        <TextField label={dict.profile.fields.phone} type="tel" autoComplete="tel" placeholder="+57 300 000 0000" {...form.field("phone")} />
        <div className="flex justify-end md:col-span-2">
          <Button type="submit">{dict.common.saveChanges}</Button>
        </div>
      </form>
    </Card>
  );
}

function Mfa() {
  const { dict, href } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-bold">{dict.profile.twoFactor.title}</p>
      <p className="text-on-surface-variant">{dict.auth0.mfaDescription}</p>
      <Auth0Link intent="mfa" returnTo={href("/perfil")} variant="tonal">
        <ShieldCheck aria-hidden="true" className="size-5" /> {dict.auth0.mfaSetup}
      </Auth0Link>
    </div>
  );
}

function ChangePassword() {
  const { dict } = useI18n();
  const { notify } = useToast();
  const [sending, setSending] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-bold">{dict.profile.password.title}</p>
      <p className="text-sm text-on-surface-variant">{dict.auth0.passwordDescription}</p>
      <Button
        variant="secondary"
        loading={sending}
        icon={<KeyRound aria-hidden="true" className="size-4" />}
        onClick={async () => {
          setSending(true);
          try {
            const res = await fetch("/api/auth/change-password", { method: "POST" });
            notify(res.ok ? dict.auth0.passwordEmailSent : dict.auth0.passwordEmailError, res.ok ? "success" : "error");
          } catch {
            notify(dict.auth0.passwordEmailError, "error");
          } finally {
            setSending(false);
          }
        }}
      >
        {dict.auth0.sendPasswordEmail}
      </Button>
    </div>
  );
}

export function ProfileView() {
  const { dict, plural } = useI18n();
  const { user, updateProfile } = useAuth();
  const households = useHouseholds();
  const { notify } = useToast();
  const [photoError, setPhotoError] = useState<string | null>(null);
  if (!user) return null;
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <>
      <PageHeader title={dict.profile.title} subtitle={dict.profile.subtitle} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-8">
          <Card tone="container" className="flex flex-col items-center gap-4 overflow-hidden p-0 pb-8 text-center">
            <div aria-hidden="true" className="h-24 w-full bg-primary" />
            <div className="relative -mt-16">
              {user.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo} alt={dict.profile.photoAlt} className="size-28 rounded-full border-4 border-white object-cover" />
              ) : (
                <span className="flex size-28 items-center justify-center rounded-full border-4 border-white bg-surface-high text-3xl font-bold text-primary">
                  {initials}
                </span>
              )}
              <label className="absolute right-0 bottom-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3">
                <Camera aria-hidden="true" className="size-4" />
                <span className="sr-only">{dict.profile.changePhoto}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    setPhotoError(null);
                    if (!file) return;
                    if (!["image/png", "image/jpeg"].includes(file.type)) return setPhotoError(dict.files.invalidImage);
                    if (file.size > 1024 * 1024) return setPhotoError(dict.profile.photoTooLarge);
                    updateProfile({ photo: await readFileAsDataUrl(file) });
                    notify(dict.profile.photoUpdated);
                  }}
                />
              </label>
            </div>
            {photoError && (
              <p role="alert" className="px-6 text-sm font-semibold text-error">
                {photoError}
              </p>
            )}
            <div className="px-6">
              <h2 className="text-2xl font-bold" data-testid="profile-name">
                {user.name}
              </h2>
              <p className="text-on-surface-variant">{dict.profile.role}</p>
              <p className="flex items-center justify-center gap-1 text-on-surface-variant">
                {user.email}
                {user.emailVerified && <BadgeCheck aria-label={dict.auth0.emailVerified} className="size-4 text-primary" />}
              </p>
              {user.phone && <p className="text-on-surface-variant">{user.phone}</p>}
            </div>
            <Badge tone="info">{plural(dict.profile.households, households.items.length)}</Badge>
          </Card>

          <Card tone="container" aria-labelledby="security-title" className="flex flex-col gap-6">
            <h2 id="security-title" className="flex items-center gap-3 text-xl font-bold">
              <ShieldCheck aria-hidden="true" className="size-5" /> {dict.profile.security}
            </h2>
            <Mfa />
          </Card>
        </div>
        <div className="flex flex-col gap-8">
          <PersonalData key={user.id} user={user} />
          <Card tone="container">
            <ChangePassword />
          </Card>
        </div>
      </div>
    </>
  );
}
