import { Usuario } from "../../../core/models/usuario.model";
import { CampoNumero, CampoSelecao, CampoTexto } from "../../../shared/components/formulario/campos";
import { OpcoesFormulario } from "../../../shared/components/formulario/formulario.model";

const camposFormulario = () => [
  new CampoTexto({
    chave: 'nome', rotulo: 'Nome', obrigatorio: true
  }),
  new CampoTexto({
    chave: 'email', rotulo: 'E-mail', obrigatorio: true, formato: 'email'
  }),
  new CampoTexto({
    chave: 'senha', rotulo: 'Senha', obrigatorio: true, formato: 'password', alternarVisibilidade: true,
    minimoCaracteres: 6
  }),
  new CampoTexto({
    chave: 'confirmarSenha', rotulo: 'Confirmar senha', obrigatorio: true, formato: 'password', alternarVisibilidade: true,
    minimoCaracteres: 6
  }),
  new CampoSelecao({
    chave: 'role', rotulo: 'Nível de acesso', obrigatorio: true, opcoes: [
      { valor: 'PROFISSIONAL', rotulo: 'Profissional' },
      { valor: 'ADMIN', rotulo: 'Admin' }
    ]
  }),
  new CampoTexto({
    chave: 'profissao', rotulo: 'Profissão', placeholder: 'Psicólogo'
  }),
  new CampoNumero({
    chave: 'taxaComissaoPadrao', rotulo: 'Comissão da clínica (%)', minimo: 0, maximo: 100, obrigatorio: true
  })
]

type CamposFormulario = ReturnType<typeof camposFormulario>;

export function criarUsuarioForm(): OpcoesFormulario<CamposFormulario, Usuario> {
  return {
    titulo: 'Criar usuário',
    campos: camposFormulario(),
    valores: { taxaComissaoPadrao: 40, role: 'PROFISSIONAL' },
    validar: v => v.senha && v.confirmarSenha && v.senha !== v.confirmarSenha ?
      { confirmarSenha: "As senhas não coincidem" } : null
  }
}
