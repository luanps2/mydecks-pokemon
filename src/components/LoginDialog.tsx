import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Modal } from "./Modal";

const back = () => window.location.origin + import.meta.env.BASE_URL;   // volta para o app depois de entrar

/* Mensagens do Supabase em português simples */
function msg(e: { message: string }): string {
  const m = e.message || "";
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m)) return "Você ainda não confirmou o seu e-mail. Abra o link que enviamos para ativar a conta.";
  if (/already registered|already been registered/i.test(m)) return "Já existe uma conta com esse e-mail. Use \"Entrar\" ou \"Esqueci a senha\".";
  if (/at least \d+ characters|Password should/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit|only request this after|security purposes/i.test(m)) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (/invalid.*email|Unable to validate email/i.test(m)) return "Esse e-mail não parece válido.";
  if (/Signups not allowed|signup.*disabled/i.test(m)) return "O cadastro com e-mail e senha está desligado no Supabase.";
  return "Não deu certo: " + m;
}

const GOOGLE = <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.9 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.2a11 11 0 0 0 0 9.9l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.7 2.8C6.8 7.3 9.2 5.4 12 5.4z"/></svg>;

type Tab = "entrar" | "criar" | "link" | "esqueci";

/* Entrar: Google, e-mail e senha, ou link mágico por e-mail. Criar conta com e-mail e senha pede confirmação do e-mail. */
export function LoginDialog({ open, onClose, needed = false }: {
  open: boolean;
  onClose: () => void;
  /** aberta porque a pessoa tentou montar um deck sem conta: abre em "Criar conta" com o aviso */
  needed?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(needed ? "criar" : "entrar");   // o App troca a key quando muda "needed"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<"" | "confirmar" | "link" | "senha">("");
  const [unconfirmed, setUnconfirmed] = useState(false);

  const go = (t: Tab) => { setTab(t); setErr(""); setDone(""); setUnconfirmed(false); };
  const close = () => { go("entrar"); setPass(""); setPass2(""); onClose(); };

  async function google() {
    setErr("");
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back() } });
    if (error) setErr(msg(error));
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr("");
    try { await fn(); } finally { setBusy(false); }
  }
  const signIn = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) { setErr(msg(error)); setUnconfirmed(/Email not confirmed/i.test(error.message)); return; }
    close();
  }); };
  const signUp = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    if (pass.length < 6) { setErr("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (pass !== pass2) { setErr("As duas senhas não são iguais."); return; }
    const { data, error } = await supabase!.auth.signUp({
      email: email.trim(), password: pass,
      options: { emailRedirectTo: back(), data: { full_name: name.trim().slice(0, 60) || undefined } },
    });
    if (error) { setErr(msg(error)); return; }
    // o Supabase não conta se o e-mail já existe (por segurança): devolve um usuário sem identidades
    if (data.user && !data.user.identities?.length) { setErr("Já existe uma conta com esse e-mail. Use \"Entrar\" ou \"Esqueci a senha\"."); return; }
    if (data.session) { close(); return; }   // projeto sem confirmação de e-mail: já entrou
    setDone("confirmar");
  }); };
  const resend = () => void run(async () => {
    const { error } = await supabase!.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: back() } });
    setErr(error ? msg(error) : "");
    if (!error) { setDone("confirmar"); setUnconfirmed(false); }
  });
  const magic = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: back() } });
    if (error) setErr(msg(error)); else setDone("link");
  }); };
  const forgot = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: back() });
    if (error) setErr(msg(error)); else setDone("senha");
  }); };

  const emailInput = <input type="email" required autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />;

  return (
    <Modal open={open} onClose={close} label="Entrar" className="small login">
      <h4>{tab === "criar" ? "Criar conta" : tab === "esqueci" ? "Esqueci a senha" : "Entrar"}</h4>
      {needed
        ? <p className="need-account"><b>Para montar decks, crie uma conta.</b> É grátis e leva um minuto. Sem conta, dá para ver os decks prontos, o catálogo e os decks dos outros treinadores.</p>
        : <p className="meta">Com uma conta, seus decks ficam salvos na nuvem, aparecem em qualquer aparelho e no seu perfil de treinador.</p>}

      {(tab === "entrar" || tab === "criar") && (
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "entrar"} onClick={() => go("entrar")}>Já tenho conta</button>
          <button type="button" role="tab" aria-selected={tab === "criar"} onClick={() => go("criar")}>Criar conta</button>
        </div>
      )}

      {done === "confirmar" ? (
        <div className="ok">
          <b>Falta só confirmar o e-mail.</b> Enviamos um link para <b>{email}</b>. Abra o e-mail e clique no link para ativar a conta; depois é só entrar.
          <small>Não chegou? Olhe a caixa de spam ou <button type="button" className="linkish" disabled={busy} onClick={resend}>envie de novo</button>.</small>
        </div>
      ) : done === "link" ? (
        <p className="ok">Link enviado para <b>{email}</b>. Abra o e-mail neste aparelho e clique no link para entrar.</p>
      ) : done === "senha" ? (
        <p className="ok">Enviamos para <b>{email}</b> um link para criar uma senha nova. Abra o e-mail e clique no link.</p>
      ) : tab === "entrar" ? (
        <>
          <button type="button" className="google" onClick={google}>{GOOGLE}Entrar com o Google</button>
          <div className="or"><span>ou com e-mail e senha</span></div>
          <form className="auth-form" onSubmit={signIn}>
            {emailInput}
            <input type="password" required autoComplete="current-password" placeholder="Senha" value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Senha" />
            <button type="submit" className="success" disabled={busy}>Entrar</button>
          </form>
          {unconfirmed && <p className="note"><button type="button" className="linkish" disabled={busy} onClick={resend}>Enviar o e-mail de confirmação de novo</button></p>}
          <p className="auth-links">
            <button type="button" className="linkish" onClick={() => go("esqueci")}>Esqueci a senha</button>
            <span>·</span>
            <button type="button" className="linkish" onClick={() => go("link")}>Entrar sem senha (link por e-mail)</button>
          </p>
        </>
      ) : tab === "criar" ? (
        <>
          <button type="button" className="google" onClick={google}>{GOOGLE}Criar conta com o Google</button>
          <div className="or"><span>ou com e-mail e senha</span></div>
          <form className="auth-form" onSubmit={signUp}>
            <input autoComplete="nickname" placeholder="Seu nome de treinador (aparece no perfil)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome de treinador" maxLength={60} />
            {emailInput}
            <input type="password" required minLength={6} autoComplete="new-password" placeholder="Senha (pelo menos 6 caracteres)" value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Senha" />
            <input type="password" required minLength={6} autoComplete="new-password" placeholder="Repita a senha" value={pass2} onChange={(e) => setPass2(e.target.value)} aria-label="Repita a senha" />
            <button type="submit" className="success" disabled={busy}>Criar conta</button>
          </form>
          <p className="note">Vamos mandar um e-mail para confirmar que ele é seu. A conta só fica ativa depois de clicar no link.</p>
        </>
      ) : tab === "link" ? (
        <>
          <p className="note" style={{ marginTop: 0 }}>Receba um link no e-mail e entre sem precisar de senha.</p>
          <form className="row" onSubmit={magic}>
            {emailInput}
            <button type="submit" className="success" disabled={busy}>Enviar link</button>
          </form>
        </>
      ) : (
        <>
          <p className="note" style={{ marginTop: 0 }}>Digite o e-mail da conta. Vamos mandar um link para você criar uma senha nova.</p>
          <form className="row" onSubmit={forgot}>
            {emailInput}
            <button type="submit" className="success" disabled={busy}>Enviar link</button>
          </form>
        </>
      )}

      {(tab === "link" || tab === "esqueci" || done) && (
        <p className="auth-links"><button type="button" className="linkish" onClick={() => go("entrar")}>← Voltar para entrar</button></p>
      )}
      {err && <p className="note warn" role="alert">{err}</p>}
      <p className="note">Guardamos só o seu e-mail, o nome e a foto do perfil e os seus decks. Os decks aparecem no seu perfil em Treinadores, a não ser que você marque "Deck privado".</p>
    </Modal>
  );
}

/* Link "criar senha nova" do e-mail: o Supabase volta para o site já conectado e avisa (PASSWORD_RECOVERY); aqui a pessoa escolhe a senha */
export function PasswordRecovery() {
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") setOpen(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (pass.length < 6) { setErr("A senha precisa ter pelo menos 6 caracteres."); return; }
    const { error } = await supabase!.auth.updateUser({ password: pass });
    if (error) setErr(msg(error)); else { setOk(true); setErr(""); }
  }
  return (
    <Modal open={open} onClose={() => { setOpen(false); setOk(false); setPass(""); }} label="Senha nova" className="small login">
      <h4>Senha nova</h4>
      {ok ? <p className="ok">Pronto! A senha foi trocada e você já está conectado.</p> : (
        <form className="auth-form" onSubmit={save}>
          <input type="password" required minLength={6} autoComplete="new-password" placeholder="Senha nova (pelo menos 6 caracteres)" value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Senha nova" />
          <button type="submit" className="success">Salvar senha</button>
        </form>
      )}
      {err && <p className="note warn" role="alert">{err}</p>}
    </Modal>
  );
}
