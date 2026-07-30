import React, { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Eye, EyeOff, KeyRound, Mail, Music2, Settings2, TrendingUp, Volume2, VolumeX, Wand2 } from "lucide-react";
import { Button, Card, Input, Label, Select, Skeleton, SkeletonCard, SkeletonText, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui";
import { sounds } from "../sound";
import { useAppSettings } from "../settings/AppSettingsContext";
import { AcademicCatalogSettings } from "./AcademicCatalogSettings";
import { ProgressionSettings } from "./ProgressionSettings";

const SettingsGeneralSkeleton: React.FC = () => (
  <div className="flex flex-1 flex-col gap-4" role="status" aria-label="Loading application settings" aria-busy="true">
    <span className="sr-only">Loading application settings…</span>
    <div className="grid flex-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {[0, 1].map(card => (
        <SkeletonCard key={card} className="flex min-h-[25rem] flex-col">
          <div className="flex items-start gap-3 border-b border-[#EEEAF8] pb-4">
            <Skeleton shape="block" className="h-10 w-10 shrink-0 rounded-2xl" />
            <div className="flex-1 pt-1"><Skeleton className="h-4 w-36" /><Skeleton className="mt-2 h-3 w-3/4" /></div>
            {card === 0 && <Skeleton className="h-7 w-12 rounded-full" />}
          </div>
          <div className="mt-5 space-y-4">
            <SkeletonText lines={2} />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            {card === 0 && <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-9" />)}</div>}
          </div>
          <Skeleton className="mt-auto h-11 w-full" />
        </SkeletonCard>
      ))}
    </div>
    <SkeletonCard className="flex min-h-16 items-center justify-end p-3 sm:px-4"><Skeleton className="h-11 w-full sm:w-36" /></SkeletonCard>
  </div>
);

export const SettingsPage: React.FC = () => {
  const { settings, loading, loadError, save, testAi, testMail } = useAppSettings();
  const [soundEnabled, setSoundEnabled] = useState(settings.sound_enabled);
  const [model, setModel] = useState(settings.ai_model);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [clearApiKey, setClearApiKey] = useState(false);
  const [mailTransport, setMailTransport] = useState(settings.mail_transport);
  const [mailFrom, setMailFrom] = useState(settings.mail_from ?? "");
  const [smtpHost, setSmtpHost] = useState(settings.smtp_host ?? "");
  const [smtpPort, setSmtpPort] = useState(String(settings.smtp_port ?? ""));
  const [smtpUsername, setSmtpUsername] = useState(settings.smtp_username ?? "");
  const [smtpUseTls, setSmtpUseTls] = useState(Boolean(settings.smtp_use_tls));
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<"general" | "curriculum" | "progression">("general");

  useEffect(() => {
    setSoundEnabled(settings.sound_enabled);
    setModel(settings.ai_model);
    setMailTransport(settings.mail_transport);
    setMailFrom(settings.mail_from ?? "");
    setSmtpHost(settings.smtp_host ?? "");
    setSmtpPort(String(settings.smtp_port ?? ""));
    setSmtpUsername(settings.smtp_username ?? "");
    setSmtpUseTls(Boolean(settings.smtp_use_tls));
  }, [
    settings.sound_enabled, settings.ai_model, settings.mail_transport, settings.mail_from,
    settings.smtp_host, settings.smtp_port, settings.smtp_username, settings.smtp_use_tls,
  ]);

  const toggleSound = (next: boolean) => {
    setSoundEnabled(next);
    sounds.setEnabled(next);
    if (next) sounds.playPop();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await save({
        sound_enabled: soundEnabled,
        ai_model: model,
        ...(apiKey.trim() ? { openai_api_key: apiKey.trim() } : {}),
        clear_api_key: clearApiKey,
        mail_transport: mailTransport,
        mail_from: mailFrom.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: smtpPort.trim() ? Number(smtpPort) : undefined,
        smtp_username: smtpUsername.trim(),
        smtp_use_tls: smtpUseTls,
        ...(smtpPassword.trim() ? { smtp_password: smtpPassword.trim() } : {}),
        clear_smtp_password: clearSmtpPassword,
      });
      setApiKey("");
      setClearApiKey(false);
      setSmtpPassword("");
      setClearSmtpPassword(false);
      setMessage("Settings saved.");
      sounds.playSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestAi = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      await testAi();
      setMessage("OpenAI connection verified.");
      sounds.playSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect to OpenAI");
    } finally {
      setTesting(false);
    }
  };

  const handleTestMail = async () => {
    setTestingMail(true);
    setError(null);
    setMessage(null);
    try {
      const sentTo = await testMail();
      setMessage(`Test email sent to ${sentTo}.`);
      sounds.playSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send a test email");
    } finally {
      setTestingMail(false);
    }
  };

  return (
    <Tabs value={section} onValueChange={value => setSection(value as typeof section)} variant="underline" className="flex min-h-full w-full flex-col">
      <TabsList aria-label="Settings sections">
        <TabsTrigger value="general"><Settings2 size={14} /> General</TabsTrigger>
        <TabsTrigger value="curriculum"><BookOpen size={14} /> Academic catalog</TabsTrigger>
        <TabsTrigger value="progression"><TrendingUp size={14} /> Progression & mastery</TabsTrigger>
      </TabsList>

      <TabsContent value="curriculum" className="flex min-h-0 flex-1 pt-4">
        <AcademicCatalogSettings />
      </TabsContent>

      <TabsContent value="progression" className="flex min-h-0 flex-1 pt-4">
        <ProgressionSettings />
      </TabsContent>

      <TabsContent value="general" className="flex flex-1 flex-col gap-4 pt-4">
      {loading ? <SettingsGeneralSkeleton /> : <>
      {/* Otherwise the defaults below read as the account's saved settings, and saving one
          field on this screen would look like a confirmation of all of them. */}
      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Couldn’t load your saved settings, so these are the defaults — not your values.
          Reload before changing anything here.
        </div>
      )}
      <div className="grid flex-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card className="flex h-full min-w-0 flex-col border-[#E7E3F6] p-4 shadow-[0_6px_24px_rgba(83,74,183,0.06)] sm:p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#EEEAF8] pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">
              <Music2 size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#0E0B55]">Sound feedback</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">Control application sounds and preview each feedback cue.</p>
            </div>
          </div>
          <Switch
            checked={soundEnabled}
            onCheckedChange={toggleSound}
            aria-label="Toggle application sounds"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-[#EEEAF8] bg-[#FBFAFF] p-3 sm:p-4">
          <p className="mb-3 text-xs font-medium text-[#6D6997]">Preview sounds</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            <Button variant="outline" size="sm" onClick={() => sounds.playPop()} disabled={!soundEnabled}>Pop</Button>
            <Button variant="outline" size="sm" onClick={() => sounds.playTick(3)} disabled={!soundEnabled}>Chime</Button>
            <Button variant="outline" size="sm" onClick={() => sounds.playTock()} disabled={!soundEnabled}>Tock</Button>
            <Button variant="outline" size="sm" onClick={() => sounds.playWin()} disabled={!soundEnabled}>Success</Button>
            <Button variant="outline" size="sm" onClick={() => sounds.playFail()} disabled={!soundEnabled}>Try again</Button>
            <Button variant="outline" size="sm" onClick={() => sounds.playLevelUp()} disabled={!soundEnabled}>Level up</Button>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2 rounded-xl border border-[#E7E3F6] bg-white px-3 py-2.5 text-xs text-[#6D6997]">
          {soundEnabled ? <Volume2 size={14} className="text-[#534AB7]" /> : <VolumeX size={14} />}
          Sound is {soundEnabled ? "enabled" : "muted"} for the application.
          </div>
        </div>
      </Card>

      <Card className="flex h-full min-w-0 flex-col border-[#E7E3F6] p-4 shadow-[0_6px_24px_rgba(83,74,183,0.06)] sm:p-5 md:p-6">
        <div className="flex items-start gap-3 border-b border-[#EEEAF8] pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">
            <Wand2 size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#0E0B55]">AI provider</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">Configure the model and encrypted server-side credentials.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-model" className="normal-case tracking-normal">Model</Label>
            <Select id="ai-model" value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="openai-key" className="normal-case tracking-normal">OpenAI API key</Label>
              <span className={`shrink-0 text-[10px] font-medium ${settings.api_key_configured ? "text-emerald-600" : "text-[#8D89AE]"}`}>
                {settings.api_key_configured ? `Configured ${settings.api_key_hint ?? ""}` : "Not configured"}
              </span>
            </div>
            <div className="relative">
              <Input
                id="openai-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => { setApiKey(event.target.value); setClearApiKey(false); }}
                placeholder={settings.api_key_configured ? "Leave blank to keep current key" : "sk-..."}
                className="pr-10 font-mono text-xs"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((shown) => !shown)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {settings.api_key_configured && (
              <Button variant="link" size="xs" onClick={() => { setClearApiKey(true); setApiKey(""); }} className="text-rose-600">
                <KeyRound size={11} /> {clearApiKey ? "Key will be removed on save" : "Remove configured key"}
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleTestAi} loading={testing} loadingText="Testing..." disabled={!settings.api_key_configured}>
            <CheckCircle2 size={14} /> Test connection
          </Button>

          <div className="mt-auto rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] px-3 py-2.5 text-xs leading-relaxed text-[#6D6997]">
            Your API key is encrypted in MongoDB and is never included in settings responses.
          </div>
        </div>
      </Card>

      <Card className="flex h-full min-w-0 flex-col border-[#E7E3F6] p-4 shadow-[0_6px_24px_rgba(83,74,183,0.06)] sm:p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#EEEAF8] pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">
              <Mail size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#0E0B55]">Mail delivery</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">Where password resets and notification emails actually go out through.</p>
            </div>
          </div>
          <span className={`shrink-0 text-[10px] font-medium ${settings.mail_configured ? "text-emerald-600" : "text-[#8D89AE]"}`}>
            {settings.mail_configured ? "SMTP configured" : "Console (dev only)"}
          </span>
        </div>

        <div className="mt-4 flex flex-1 flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="mail-transport" className="normal-case tracking-normal">Transport</Label>
            <Select id="mail-transport" value={mailTransport} onChange={(event) => setMailTransport(event.target.value as "console" | "smtp")}>
              <option value="console">Console (logs only — nothing is sent)</option>
              <option value="smtp">SMTP</option>
            </Select>
          </div>

          {mailTransport === "smtp" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-host" className="normal-case tracking-normal">Host</Label>
                  <Input id="smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-port" className="normal-case tracking-normal">Port</Label>
                  <Input id="smtp-port" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-username" className="normal-case tracking-normal">Username</Label>
                <Input id="smtp-username" value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="smtp-password" className="normal-case tracking-normal">Password</Label>
                  <span className={`shrink-0 text-[10px] font-medium ${settings.smtp_password_hint ? "text-emerald-600" : "text-[#8D89AE]"}`}>
                    {settings.smtp_password_hint ? `Configured ${settings.smtp_password_hint}` : "Not configured"}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="smtp-password"
                    type={showSmtpPassword ? "text" : "password"}
                    value={smtpPassword}
                    onChange={(event) => { setSmtpPassword(event.target.value); setClearSmtpPassword(false); }}
                    placeholder={settings.smtp_password_hint ? "Leave blank to keep current password" : "••••••••"}
                    className="pr-10 font-mono text-xs"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword((shown) => !shown)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showSmtpPassword ? "Hide password" : "Show password"}
                  >
                    {showSmtpPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {settings.smtp_password_hint && (
                  <Button variant="link" size="xs" onClick={() => { setClearSmtpPassword(true); setSmtpPassword(""); }} className="text-rose-600">
                    <KeyRound size={11} /> {clearSmtpPassword ? "Password will be removed on save" : "Remove configured password"}
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] px-3.5 py-2.5">
                <Label className="normal-case tracking-normal">Use TLS</Label>
                <Switch checked={smtpUseTls} onCheckedChange={setSmtpUseTls} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mail-from" className="normal-case tracking-normal">From address</Label>
                <Input id="mail-from" value={mailFrom} onChange={(e) => setMailFrom(e.target.value)} placeholder="Koda <no-reply@koda.app>" />
              </div>
            </>
          )}

          <Button variant="outline" size="sm" onClick={handleTestMail} loading={testingMail} loadingText="Sending..." disabled={!settings.mail_configured}>
            <CheckCircle2 size={14} /> Send test email
          </Button>

          <div className="mt-auto rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] px-3 py-2.5 text-xs leading-relaxed text-[#6D6997]">
            The password is encrypted in MongoDB and is never included in settings responses. Save first, then send a test.
          </div>
        </div>
      </Card>
      </div>

      <Card className="flex flex-col-reverse gap-3 border-[#E7E3F6] p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-h-5 text-xs">
          {message && <span className="text-emerald-600">{message}</span>}
          {error && <span className="text-rose-600">{error}</span>}
        </div>
        <Button onClick={handleSave} loading={saving} loadingText="Saving..." disabled={loading} className="w-full sm:w-auto">
          Save settings
        </Button>
      </Card>
      </>}
      </TabsContent>
    </Tabs>
  );
};
