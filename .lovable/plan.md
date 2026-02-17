

# Corrigir Todos os Erros de Build

O sistema inteiro está parado porque existem **mais de 25 erros de TypeScript** que impedem o build. Nenhuma funcionalidade (salvar clientes, profissionais ou servicos) funciona enquanto esses erros nao forem corrigidos.

## Erros por Arquivo

### 1. Dashboard.tsx (5 erros)
- Propriedade `servicePrice` duplicada no tipo `Appointment` (linhas 19 e 22)
- Chave `rescheduled` duplicada nos objetos `statusColors` e `statusLabels` (linhas 31 e 40)
- Falta a propriedade `professionalId` no mapeamento dos dados (linha 95)

**Correcao:** Remover duplicatas e adicionar `professionalId` ao mapeamento.

### 2. CalendarPage.tsx (4 erros)
- Variavel `statusRaw` nao existe (linhas 115-121). O codigo usa `statusRaw` mas a variavel nunca foi declarada.

**Correcao:** Declarar `const statusRaw = String(row.status ?? "");` antes do uso.

### 3. ClientsPage.tsx (4 erros)
- Usa `form.birthDate` mas o campo real e `form.birthday` (linha 141)
- Usa `form.acceptsMessages` mas o campo real e `form.allowWhatsapp` (linha 144)
- Usa `client.acceptsMessages` mas o campo real e `client.allowWhatsapp` (linha 183)
- `MessageHistoryDialog` nao esta importado (linha 187)

**Correcao:** Corrigir nomes dos campos e adicionar import do `MessageHistoryDialog`.

### 4. FinancialPage.tsx (12+ erros)
- Tipo `FinanceRow.status` aceita apenas `"pago" | "pendente"` mas `toStatus()` retorna `"vencido"` tambem (linhas 121-122)
- Variavel `filteredReceivables` e `filteredPayables` nao existem (linhas 143-149) -- provavelmente deveriam ser `receivables` e `payables` filtrados por periodo
- `totals.balance` nao existe no retorno do `useMemo` (linha 249) -- deveria ser `totals.profit`
- Comparacao `r.status === "vencido"` e impossivel com o tipo atual (linhas 307, 335)
- Funcao `markAsPaid` nao existe (linhas 308, 336)

**Correcao:**
- Expandir tipo de status para `"pago" | "pendente" | "vencido"`
- Criar variaveis `filteredReceivables`/`filteredPayables` com filtro por periodo
- Trocar `totals.balance` por `totals.profit`
- Criar funcao `markAsPaid`

### 5. ProfessionalsPage.tsx (7 erros)
- Tipo `ProfessionalStats` nao existe (linha 23)
- Tipo `ProfessionalRow` nao existe (linha 48) -- deveria ser `Professional`
- `Professional` (de `lib/professionals.ts`) nao tem `commissionPercent` nem `specialties` (linhas 133, 146, 148, 178)
- `toCurrency` nao esta importado (linha 179)

**Correcao:**
- Criar tipo `ProfessionalStats` local
- Atualizar tipo `Professional` em `lib/professionals.ts` para incluir `commissionPercent` e `specialties`
- Ou criar tipo local na pagina com os campos corretos
- Importar `toCurrency` de `@/lib/database`

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Remover propriedades duplicadas, adicionar `professionalId` ao mapeamento |
| `src/pages/CalendarPage.tsx` | Declarar variavel `statusRaw` |
| `src/pages/ClientsPage.tsx` | Corrigir nomes dos campos do form, importar `MessageHistoryDialog` |
| `src/pages/FinancialPage.tsx` | Expandir tipo de status, criar `filteredReceivables`/`filteredPayables`, criar `markAsPaid`, corrigir `balance` para `profit` |
| `src/pages/ProfessionalsPage.tsx` | Criar tipos locais, importar `toCurrency`, corrigir referencias |
| `src/lib/professionals.ts` | Adicionar campos `commissionPercent` e `specialties` ao tipo `Professional` |

## Resultado Esperado
Apos essas correcoes, o build voltara a funcionar e sera possivel salvar clientes, profissionais e servicos normalmente.
