import { Job, Course } from './types';
import { supabase } from './lib/supabaseClient';

const DEFAULT_JOBS: Job[] = [
  {
    id: 'job-1',
    title: 'Atendente de Farmácia',
    company: 'FarmaBem',
    category: 'Saúde',
    description: 'Atendimento ao cliente, leitura e interpretação de receitas médicas, organização de medicamentos e produtos de higiene, além de verificação da validade do estoque.',
    requirements: [
      'Ensino médio completo',
      'Boa comunicação e empatia',
      'Disponibilidade para trabalhar em escalas (incluindo finais de semana)',
      'Não é necessária experiência prévia (oferecemos treinamento)'
    ],
    salary: 'R$ 1.650,00 + Benefícios',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - Centro',
    lat: -25.5912,
    lng: -49.4150,
    logo: '/assets/images/logo_farmabem_1793965852222.jpg',
    dateString: 'Hoje',
    color: 'border-l-blue-500'
  },
  {
    id: 'job-2',
    title: 'Auxiliar de Produção',
    company: 'Indústria Metálika',
    category: 'Indústria',
    description: 'Atuar na linha de montagem e verificação de peças industriais. Será responsável por manter a organização do setor e auxiliar os operadores de máquinas.',
    requirements: [
      'Ensino fundamental completo',
      'Atenção aos detalhes e compromisso com normas de segurança',
      'Disponibilidade de horário para turnos',
      'Vaga também aberta para primeiro emprego'
    ],
    salary: 'R$ 1.820,00 + Vale Alimentação',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - Polo Industrial / Petrobras',
    lat: -25.5650,
    lng: -49.3850,
    logo: '/assets/images/logo_metalika_1793965852486.jpg',
    dateString: 'Ontem',
    color: 'border-l-blue-500'
  },
  {
    id: 'job-3',
    title: 'Recepcionista Clínico',
    company: 'Clínica Vida Saudável',
    category: 'Atendimento',
    description: 'Recepção de pacientes, agendamento de consultas (presenciais e via telefone/WhatsApp), organização de guias médicas e encaminhamento interno.',
    requirements: [
      'Ensino médio completo',
      'Simpatia e excelente comunicação',
      'Noções básicas de computador e WhatsApp Web'
    ],
    salary: 'R$ 1.500,00',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - Fazenda Velha',
    lat: -25.5780,
    lng: -49.4250,
    logo: '/assets/images/logo_clinica_vida_1793965854270.jpg',
    dateString: '2 dias atrás',
    color: 'border-l-blue-500'
  },
  {
    id: 'job-4',
    title: 'Operador de Caixa',
    company: 'Supermercados Sul',
    category: 'Varejo',
    description: 'Atendimento direto ao cliente no check-out, registro de mercadorias, recebimento de pagamentos, fechamento de caixa e oferta de serviços da loja.',
    requirements: [
      'Ensino médio completo ou cursando',
      'Gostar de trabalhar com o público',
      'Vaga preferencial para moradores de Araucária'
    ],
    salary: 'R$ 1.480,00 + Quebra de Caixa',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - Costeira',
    lat: -25.5650,
    lng: -49.4020,
    logo: '/assets/images/logo_super_sul_1793965854342.jpg',
    dateString: '3 dias atrás',
    color: 'border-l-red-500'
  },
  {
    id: 'job-5',
    title: 'Assistente de Logística',
    company: 'Logística Rápida BR',
    category: 'Logística',
    description: 'Auxiliar na separação, conferência e embalagem de mercadorias, organização do estoque e suporte na roteirização de entregas.',
    requirements: [
      'Ensino médio completo',
      'Agilidade e proatividade',
      'Conhecimento básico em informática',
      'Disponibilidade para eventuais horas extras'
    ],
    salary: 'R$ 1.700,00 + Benefícios',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - Thomaz Coelho',
    lat: -25.5450,
    lng: -49.4100,
    logo: '/assets/images/logo_logistica_rapida_1793965855652.jpg',
    dateString: '5 dias atrás',
    color: 'border-l-blue-500'
  },
  {
    id: 'job-6',
    title: 'Jovem Aprendiz Administrativo',
    company: 'Nexus Corp',
    category: 'Administração',
    description: 'Oportunidade para jovens que querem iniciar no mercado de trabalho administrativo executando tarefas de controle, preenchimento de planilhas e atendimento ao cliente interno.',
    requirements: [
      'Ensino médio em andamento ou concluído',
      'Conhecimento básico no Pacote Office (Excel, Word)',
      'Organização e pontualidade',
      'Não é necessária experiência prévia'
    ],
    salary: 'R$ 820,00 + Benefícios',
    type: 'Jovem Aprendiz',
    isRemote: false,
    location: 'Araucária - Capela Velha',
    lat: -25.6100,
    lng: -49.3900,
    logo: 'https://ui-avatars.com/api/?name=NX&background=10b981&color=fff&size=128&bold=true',
    dateString: '6 dias atrás',
    color: 'border-l-blue-500'
  },
  {
    id: 'job-7',
    title: 'Estágio em Recursos Humanos (Seleção)',
    company: 'TalentTech RH',
    category: 'Recursos Humanos',
    description: 'Apoiar em triagem de currículos, agendamento de entrevistas, controle de planilhas de indicadores de RH e contato constante com candidatos. Ritmo acelerado e alta cobrança por metas de contratação.',
    requirements: [
      'Cursando Psicologia, RH ou Administração (a partir do 4º período)',
      'Inglês Intermediário (será testado)',
      'Excel Avançado (Tabela Dinâmica, PROCV, Dashboard)',
      'Extrema capacidade de lidar com pressão e prazos curtos'
    ],
    salary: 'R$ 950,00 + Vale Transporte',
    type: 'Estágio',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.4450,
    lng: -49.2650,
    logo: 'https://ui-avatars.com/api/?name=TR&background=6366f1&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-purple-500'
  },
  {
    id: 'job-8',
    title: 'Estágio em Marketing Digital',
    company: 'Agência Criativa Sul',
    category: 'Marketing',
    description: 'Criação de copys para redes sociais, acompanhamento de métricas do Google Analytics e auxílio na produção de relatórios semanais para clientes difíceis.',
    requirements: [
      'Cursando Marketing, Publicidade ou Jornalismo',
      'Domínio obrigatório de ferramentas de design (Photoshop ou Illustrator, não apenas Canva)',
      'Portfólio atualizado com trabalhos reais ou acadêmicos complexos',
      'Certificação Google Analytics e Facebook Ads (diferencial)'
    ],
    salary: 'R$ 800,00 + Bolsa Auxílio',
    type: 'Estágio',
    isRemote: true,
    location: 'Curitiba - PR (Remoto)',
    lat: -25.5100,
    lng: -49.2350,
    logo: 'https://ui-avatars.com/api/?name=AC&background=ec4899&color=fff&size=128&bold=true',
    dateString: 'Ontem',
    color: 'border-l-pink-500'
  },
  {
    id: 'job-9',
    title: 'Estágio em Contabilidade',
    company: 'Escritório Contábil Luz',
    category: 'Contabilidade',
    description: 'Auxiliar na classificação e lançamentos contábeis, conciliação bancária, auxílio na apuração de impostos (Simples Nacional, Lucro Presumido) e organização de grande volume de arquivos.',
    requirements: [
      'Estudantes de Ciências Contábeis estritamente a partir do 5º período',
      'Conhecimento prático em sistemas ERP (ex: Domínio Sistemas)',
      'Aptidão com cálculos complexos e atenção extrema a detalhes',
      'Disponibilidade para trabalhar presencialmente e realizar horas adicionais em época de fechamento'
    ],
    salary: 'R$ 1.100,00 + VR',
    type: 'Estágio',
    isRemote: false,
    location: 'Araucária - PR',
    lat: -25.5980,
    lng: -49.4250,
    logo: '/assets/images/logo_csn_araucaria_1793965855603.jpg',
    dateString: '2 dias atrás',
    color: 'border-l-teal-500'
  },
  {
    id: 'job-10',
    title: 'Estágio em Engenharia de Produção',
    company: 'Metalúrgica Forte',
    category: 'Engenharia',
    description: 'Acompanhamento do chão de fábrica, cronometragem de tempos e métodos, elaboração de relatórios de não conformidade e apoio na implementação de 5S no setor fabril.',
    requirements: [
      'Cursando Engenharia de Produção ou Mecânica (noturno obrigatório)',
      'Leitura e interpretação de desenho técnico (nível avançado)',
      'Inglês nível intermediário técnico para leitura de manuais',
      'Disposição para atuar na linha de frente (ambiente de fábrica, com uso de EPIs)'
    ],
    salary: 'R$ 1.200,00 + Transporte Fretado',
    type: 'Estágio',
    isRemote: false,
    location: 'Araucária - PR',
    lat: -25.5680,
    lng: -49.3820,
    logo: '/assets/images/logo_metalika_1793965852486.jpg',
    dateString: '4 dias atrás',
    color: 'border-l-orange-500'
  }
];

const NEW_JOBS: Omit<Job, 'id'>[] = [
  {
    title: 'Auxiliar de Almoxarifado',
    company: 'Logística Araucária',
    category: 'Logística',
    description: 'Atuar no recebimento, conferência e armazenamento de materiais industriais. Organização das prateleiras, controle de entradas e saídas do estoque com zelo e precisão.',
    requirements: [
      'Ensino médio completo',
      'Boa disposição física',
      'Conhecimento básico em sistema de estoque',
      'Curso de operador de empilhadeira será visto como diferencial'
    ],
    salary: 'R$ 1.750,00',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - PR',
    lat: -25.5780,
    lng: -49.4050,
    logo: '/assets/images/logo_berneck_1793965852701.jpg',
    dateString: 'Hoje',
    color: 'border-l-indigo-500',
    active: true
  },
  {
    title: 'Consultor de Vendas',
    company: 'Inova Telecom',
    category: 'Vendas',
    description: 'Prospecção ativa de clientes empresariais na região de Curitiba, negociação de pacotes de telecomunicações e atendimento focado no fechamento de contratos de alta rentabilidade.',
    requirements: [
      'Ensino médio completo (superior cursando é diferencial)',
      'Experiência em vendas ativas internas ou externas',
      'Facilidade de comunicação e persistência',
      'Gostar de trabalhar com metas individuais e coletivas'
    ],
    salary: 'R$ 1.900,00 + Comissões',
    type: 'CLT',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.4280,
    lng: -49.2680,
    logo: 'https://ui-avatars.com/api/?name=IT&background=06b6d4&color=fff&size=128&bold=true',
    dateString: 'Ontem',
    color: 'border-l-cyan-500',
    active: true
  },
  {
    title: 'Mecânico de Motocicletas',
    company: 'Moto Giro Araucária',
    category: 'Mecânica',
    description: 'Diagnóstico mecânico e elétrico em motocicletas multimarcas, realização de revisões periódicas, troca de peças de desgaste natural, reparos gerais e testes de pista.',
    requirements: [
      'Curso de Mecânica de Motos concluído',
      'Experiência mínima de 1 ano comprovada',
      'Habilitação categoria A',
      'Pontualidade e zelo profissional com as ferramentas'
    ],
    salary: 'R$ 2.200,00 + Adicional',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - PR',
    lat: -25.5900,
    lng: -49.4120,
    logo: 'https://ui-avatars.com/api/?name=MG&background=f97316&color=fff&size=128&bold=true',
    dateString: '2 dias atrás',
    color: 'border-l-orange-500',
    active: true
  },
  {
    title: 'Assistente de Cozinha',
    company: 'Bistrô Pinhais',
    category: 'Alimentação',
    description: 'Apoiar o chef de cozinha no pré-paro de ingredientes, organização e limpeza das bancadas de trabalho, higienização de insumos e montagem simples de pratos frios e sobremesas.',
    requirements: [
      'Ensino fundamental completo',
      'Agilidade, atenção às normas de higiene e boas práticas alimentares',
      'Não exige experiência prévia - oferecemos treinamento no local',
      'Residir próximo ou ter facilidade de transporte'
    ],
    salary: 'R$ 1.600,00 + Benefícios',
    type: 'CLT',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.4320,
    lng: -49.2780,
    logo: 'https://ui-avatars.com/api/?name=BP&background=e11d48&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-rose-500',
    active: true
  },
  {
    title: 'Operador de Empilhadeira',
    company: 'Metalúrgica Vale',
    category: 'Indústria',
    description: 'Movimentação segura de cargas pesadas, paletes e matérias-primas nos setores de expedição e armazenagem. Abastecimento de linhas de prensa e forja de peças.',
    requirements: [
      'Ensino médio completo',
      'Curso de Operador de Empilhadeira ativo (com certificado descritivo)',
      'CNH válida categoria B ou superior',
      'Foco total e compromisso rígido com as normas de segurança industrial'
    ],
    salary: 'R$ 2.400,00 + VR',
    type: 'CLT',
    isRemote: false,
    location: 'Araucária - PR',
    lat: -25.5620,
    lng: -49.3750,
    logo: 'https://ui-avatars.com/api/?name=MV&background=ea580c&color=fff&size=128&bold=true',
    dateString: 'Ontem',
    color: 'border-l-orange-600',
    active: true
  },
  {
    title: 'Auxiliar de Serviços Gerais',
    company: 'Brilho Fácil Limpeza',
    category: 'Serviços Gerais',
    description: 'Realizar a limpeza e conservação de ambientes corporativos (escritórios, banheiros e refeitório). Reposição de materiais de consumo geral nas áreas internas.',
    requirements: [
      'Desejável ensino fundamental',
      'Cordialidade para interagir com o público interno',
      'Organização e boa gestão pessoal do tempo',
      'Desejável residir na zona norte de Curitiba'
    ],
    salary: 'R$ 1.550,00 + Vale Alimentação',
    type: 'CLT',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.4550,
    lng: -49.2900,
    logo: 'https://ui-avatars.com/api/?name=BF&background=a855f7&color=fff&size=128&bold=true',
    dateString: '3 dias atrás',
    color: 'border-l-purple-500',
    active: true
  },
  {
    title: 'Estágio em Administração',
    company: 'Contábil Pinheiro',
    category: 'Administração',
    description: 'Preenchimento diário de planilhas de rateio de despesas, emissão de segundas vias de boletos, conferência de arquivos fiscais digitais e suporte no atendimento ao cliente da contabilidade.',
    requirements: [
      'Cursando Administração de Empresas, Processos Gerenciais ou áreas correlatas',
      'Conhecimento básico com planilhas Excel (filtros e formatações)',
      'Organização de pastas digitais e físicas'
    ],
    salary: 'R$ 1.000,00 + VT',
    type: 'Estágio',
    isRemote: false,
    location: 'Araucária - PR',
    lat: -25.5910,
    lng: -49.4180,
    logo: 'https://ui-avatars.com/api/?name=CP&background=10b981&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-emerald-500',
    active: true
  },
  {
    title: 'Desenvolvedor Full Stack Júnior',
    company: 'TechSolution',
    category: 'Tecnologia',
    description: 'Desenvolvimento e manutenção de aplicações web utilizando React, Node.js e banco de dados SQL. Integração de APIs e melhorias de performance.',
    requirements: [
      'Conhecimento em React e Node.js',
      'Noções de banco de dados SQL',
      'Conhecimento em Git'
    ],
    salary: 'R$ 3.500,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Curitiba - PR',
    lat: -25.4200,
    lng: -49.2700,
    logo: 'https://ui-avatars.com/api/?name=TS&background=10b981&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-blue-500',
    active: true
  },
  {
    title: 'Suporte Técnico Nível 1',
    company: 'RedeConect',
    category: 'Tecnologia',
    description: 'Atendimento e suporte técnico aos clientes, resolução de problemas de conexão e configuração de rede.',
    requirements: [
      'Ensino médio técnico ou cursando TI',
      'Boa comunicação',
      'Conhecimento em redes'
    ],
    salary: 'R$ 1.800,00 + Benefícios',
    type: 'CLT',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.4300,
    lng: -49.2800,
    logo: 'https://ui-avatars.com/api/?name=RC&background=f59e0b&color=fff&size=128&bold=true',
    dateString: 'Ontem',
    color: 'border-l-orange-500',
    active: true
  },
  {
    title: 'Analista de Dados Júnior',
    company: 'DataInsight',
    category: 'Tecnologia',
    description: 'Coleta, análise e visualização de dados para suporte à tomada de decisão. Elaboração de relatórios e dashboards.',
    requirements: [
      'Graduação em TI, Estatística ou áreas correlatas',
      'Conhecimento em SQL e ferramentas de visualização (Power BI/Tableau)',
      'Análise estatística'
    ],
    salary: 'R$ 4.000,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.4400,
    lng: -49.2900,
    logo: 'https://ui-avatars.com/api/?name=DI&background=8b5cf6&color=fff&size=128&bold=true',
    dateString: '2 dias atrás',
    color: 'border-l-purple-500',
    active: true
  },
  {
    title: 'Estagiário de Desenvolvimento Mobile',
    company: 'AppMasters',
    category: 'Tecnologia',
    description: 'Auxílio no desenvolvimento de aplicações mobile híbridas, testes e correção de bugs.',
    requirements: [
      'Cursando Ciência da Computação, Engenharia ou Sistemas de Informação',
      'Conhecimento em React Native ou Flutter',
      'Vontade de aprender'
    ],
    salary: 'R$ 1.100,00 + VT',
    type: 'Estágio',
    isRemote: true,
    location: 'Curitiba - PR',
    lat: -25.4500,
    lng: -49.3000,
    logo: 'https://ui-avatars.com/api/?name=AM&background=06b6d4&color=fff&size=128&bold=true',
    dateString: '3 dias atrás',
    color: 'border-l-cyan-500',
    active: true
  },
  {
    title: 'Desenvolvedor Front-end Pleno',
    company: 'WebStyle',
    category: 'Tecnologia',
    description: 'Desenvolvimento de interfaces web responsivas, foco em UX/UI e otimização de performance.',
    requirements: [
      'Sólidos conhecimentos em React, TypeScript e Tailwind CSS',
      'Experiência em projetos web',
      'Inglês intermediário'
    ],
    salary: 'R$ 6.000,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.4600,
    lng: -49.3100,
    logo: 'https://ui-avatars.com/api/?name=WS&background=ec4899&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-pink-500',
    active: true
  },
  {
    title: 'Desenvolvedor Back-end Java',
    company: 'EnterpriseSys',
    category: 'Tecnologia',
    description: 'Desenvolvimento e manutenção de sistemas corporativos em Java. Integração com APIs e bancos de dados.',
    requirements: [
      'Sólido conhecimento em Java',
      'Experiência com frameworks Spring',
      'Conhecimento em SQL'
    ],
    salary: 'R$ 7.000,00 + Benefícios',
    type: 'CLT',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.4700,
    lng: -49.3200,
    logo: 'https://ui-avatars.com/api/?name=ES&background=3b82f6&color=fff&size=128&bold=true',
    dateString: '4 dias atrás',
    color: 'border-l-blue-600',
    active: true
  },
  {
    title: 'Analista de Segurança da Informação',
    company: 'CyberShield',
    category: 'Tecnologia',
    description: 'Monitoramento de ameaças, resposta a incidentes e implementação de políticas de segurança.',
    requirements: [
      'Formação em TI ou Segurança',
      'Conhecimento em firewalls, ferramentas de SIEM',
      'Certificações de segurança serão diferenciais'
    ],
    salary: 'R$ 5.500,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.4800,
    lng: -49.3300,
    logo: 'https://ui-avatars.com/api/?name=CS&background=14b8a6&color=fff&size=128&bold=true',
    dateString: 'Ontem',
    color: 'border-l-teal-500',
    active: true
  },
  {
    title: 'Estagiário de QA',
    company: 'QualityTest',
    category: 'Tecnologia',
    description: 'Auxílio na execução de testes funcionais e de regressão, automação de testes.',
    requirements: [
      'Cursando TI',
      'Conhecimento básico em lógica de programação',
      'Atenção aos detalhes'
    ],
    salary: 'R$ 1.000,00 + VT',
    type: 'Estágio',
    isRemote: true,
    location: 'Curitiba - PR',
    lat: -25.4900,
    lng: -49.3400,
    logo: 'https://ui-avatars.com/api/?name=QT&background=8b5cf6&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-violet-500',
    active: true
  },
  {
    title: 'Desenvolvedor Python',
    company: 'DataFlow',
    category: 'Tecnologia',
    description: 'Desenvolvimento de scripts, automações e integração de dados usando Python.',
    requirements: [
      'Conhecimento em Python',
      'Noções de manipulação de dados',
      'Experiência com APIs'
    ],
    salary: 'R$ 4.200,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.5000,
    lng: -49.3500,
    logo: 'https://ui-avatars.com/api/?name=DF&background=eab308&color=fff&size=128&bold=true',
    dateString: '2 dias atrás',
    color: 'border-l-yellow-500',
    active: true
  },
  {
    title: 'Designer UI/UX Júnior',
    company: 'CreativeDesign',
    category: 'Tecnologia',
    description: 'Criação de wireframes, protótipos e design de interfaces para aplicações web e mobile.',
    requirements: [
      'Experiência com ferramentas como Figma ou Adobe XD',
      'Conhecimento em princípios de UX/UI',
      'Portfólio'
    ],
    salary: 'R$ 3.000,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.5100,
    lng: -49.3600,
    logo: 'https://ui-avatars.com/api/?name=CD&background=f97316&color=fff&size=128&bold=true',
    dateString: 'Ontem',
    color: 'border-l-orange-500',
    active: true
  },
  {
    title: 'Desenvolvedor React Native',
    company: 'MobileTech',
    category: 'Tecnologia',
    description: 'Desenvolvimento de aplicativos móveis nativos utilizando React Native.',
    requirements: [
      'Experiência com React Native',
      'Conhecimento em JavaScript e TypeScript',
      'Publicação de apps'
    ],
    salary: 'R$ 5.800,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.5200,
    lng: -49.3700,
    logo: 'https://ui-avatars.com/api/?name=MT&background=3b82f6&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-blue-500',
    active: true
  },
  {
    title: 'Analista de Infraestrutura TI',
    company: 'InfraMaster',
    category: 'Tecnologia',
    description: 'Gestão de servidores, redes, nuvem e suporte à infraestrutura de TI.',
    requirements: [
      'Experiência com ambientes cloud (AWS/Azure)',
      'Conhecimento em redes e sistemas operacionais',
      'Certificações'
    ],
    salary: 'R$ 6.500,00 + Benefícios',
    type: 'CLT',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.5300,
    lng: -49.3800,
    logo: 'https://ui-avatars.com/api/?name=IM&background=64748b&color=fff&size=128&bold=true',
    dateString: '3 dias atrás',
    color: 'border-l-slate-500',
    active: true
  },
  {
    title: 'Administrador de Banco de Dados',
    company: 'DataBasePro',
    category: 'Tecnologia',
    description: 'Gerenciamento, tunning e backup de bancos de dados relacionais e não relacionais.',
    requirements: [
      'Conhecimento em SQL e bancos de dados (PostgreSQL, MySQL, MongoDB)',
      'Experiência em administração de DB',
      'Resolução de problemas de performance'
    ],
    salary: 'R$ 6.800,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.5400,
    lng: -49.3900,
    logo: 'https://ui-avatars.com/api/?name=DB&background=22c55e&color=fff&size=128&bold=true',
    dateString: 'Ontem',
    color: 'border-l-green-500',
    active: true
  },
  {
    title: 'Desenvolvedor PHP/Laravel',
    company: 'WebSoluções',
    category: 'Tecnologia',
    description: 'Desenvolvimento de sistemas web utilizando PHP e framework Laravel.',
    requirements: [
      'Experiência com PHP e Laravel',
      'Conhecimento em banco de dados e APIs',
      'Familiaridade com frontend'
    ],
    salary: 'R$ 4.000,00 + Benefícios',
    type: 'CLT',
    isRemote: true,
    location: 'Remoto',
    lat: -25.5500,
    lng: -49.4000,
    logo: 'https://ui-avatars.com/api/?name=WS&background=8b5cf6&color=fff&size=128&bold=true',
    dateString: 'Hoje',
    color: 'border-l-purple-500',
    active: true
  },
  {
    title: 'Analista de Suporte de Sistemas',
    company: 'SysSupport',
    category: 'Tecnologia',
    description: 'Suporte a sistemas ERP, resolução de problemas e treinamento de usuários.',
    requirements: [
      'Experiência em suporte a sistemas corporativos',
      'Bom relacionamento interpessoal',
      'Conhecimento em SQL básico'
    ],
    salary: 'R$ 2.800,00 + Benefícios',
    type: 'CLT',
    isRemote: false,
    location: 'Curitiba - PR',
    lat: -25.5600,
    lng: -49.4100,
    logo: 'https://ui-avatars.com/api/?name=SS&background=4f46e5&color=fff&size=128&bold=true',
    dateString: '2 dias atrás',
    color: 'border-l-indigo-500',
    active: true
  }
];


const DEFAULT_COURSES: Course[] = [
  {
    id: 'course-22',
    title: 'Curso de Desenho e Técnicas Artísticas',
    logo: 'Palette',
    coverImage: 'https://img.youtube.com/vi/OMD5-3WCUE0/hqdefault.jpg',
    desc: 'Descubra a sua habilidade artística através de lições passo a passo sobre fundamentos do desenho. Domine técnicas essenciais de traço, observação analítica, contorno, criação de cartuns, realismo básico e introdução à vibrante pintura com Guache.',
    category: 'Artes',
    duration: '14 aulas (2h 13m)',
    instructor: 'Especialista em Artes Visuais',
    rating: 5.0,
    level: 'Iniciante',
    lessons: [
      { title: 'Aula 1: Habilidade e Traço (Parte 1)', duration: '11:02', done: false, youtubeId: 'OMD5-3WCUE0' },
      { title: 'Aula 2: Habilidade e Traço (Parte 2)', duration: '4:09', done: false, youtubeId: 'evk6U1WhO7o' },
      { title: 'Aula 3: Observação (Parte 1)', duration: '9:19', done: false, youtubeId: 'mfy8Bqa2eYM' },
      { title: 'Aula 4: Observação (Parte 2)', duration: '5:13', done: false, youtubeId: '7G8OKP1BTPg' },
      { title: 'Aula 5: Observação (Parte 3)', duration: '9:19', done: false, youtubeId: 'xWbe8xq3aME' },
      { title: 'Aula 6: Contorno (Parte 1)', duration: '5:52', done: false, youtubeId: 'Oh0Vdok40do' },
      { title: 'Aula 7: Cartuns (Parte 2)', duration: '5:32', done: false, youtubeId: 'af6hZzPq7FE' },
      { title: 'Aula 8: Cartuns (Parte 3)', duration: '7:33', done: false, youtubeId: 'af6hZzPq7FE' },
      { title: 'Aula 9: Cartuns (Parte 4)', duration: '11:24', done: false, youtubeId: 'LTdWF-eo_Zo' },
      { title: 'Aula 10: Realismo (Parte 1)', duration: '13:34', done: false, youtubeId: 'af6hZzPq7FE' },
      { title: 'Aula 11: Realismo (Parte 2)', duration: '12:17', done: false, youtubeId: '8ofN3Qclxsc' },
      { title: 'Aula 12: Realismo (Parte 3)', duration: '9:58', done: false, youtubeId: 'lWBc9r1jDi8' },
      { title: 'Aula 13: Pintura Guache (Parte 1)', duration: '11:12', done: false, youtubeId: '_2wV_bodSBc' },
      { title: 'Aula 14: Pintura Guache (Parte 2)', duration: '7:06', done: false, youtubeId: 'GYHV5LRmxEo' }
    ],
    completed: false
  },
  {
    id: 'course-21',
    title: 'Curso de Investimentos',
    logo: 'TrendingUp',
    coverImage: 'https://img.youtube.com/vi/KjTUcj-Bp0o/hqdefault.jpg',
    desc: 'Quer aprender a investir do zero com segurança e sabedoria? Este curso prático aborda os conceitos fundamentais do mercado de capitais: Poupança x Investimentos, Renda Fixa e Renda Variável, Tesouro Direto, Fundos de Investimento, Ações, Planejamento Financeiro pessoal e estratégias essenciais para fazer o seu dinheiro trabalhar para você.',
    category: 'Finanças',
    duration: '10 aulas (1h 34m)',
    instructor: 'Especialista em Finanças Pessoais',
    rating: 4.9,
    level: 'Iniciante ao Avançado',
    lessons: [
      { title: 'Aula 1: Poupança X Investimento - Onde colocar seu dinheiro?', duration: '8:07', done: false, youtubeId: 'KjTUcj-Bp0o' },
      { title: 'Aula 2: Conceitos Fundamentais e Planejamento para Começar', duration: '14:40', done: false, youtubeId: 'hI6nDUsCbPc' },
      { title: 'Aula 3: O que é e como funciona a Renda Fixa', duration: '7:19', done: false, youtubeId: 'DogNkkNNv5s' },
      { title: 'Aula 4: Guia Completo do Tesouro Direto para Iniciantes', duration: '9:06', done: false, youtubeId: 'y6TsvrLVEA8' },
      { title: 'Aula 5: Introdução à Renda Variável e Bolsa de Valores', duration: '8:01', done: false, youtubeId: 'lYY90AWRGWA' },
      { title: 'Aula 6: Como Escolher e Comprar sua Primeira Ação', duration: '11:28', done: false, youtubeId: 'tlKhFv1CnxI' },
      { title: 'Aula 7: Entendendo os Fundos de Investimento Imobiliário (FIIs)', duration: '6:00', done: false, youtubeId: 'kmCcu10c85I' },
      { title: 'Aula 8: Diversificação de Carteira e Mitigação de Riscos', duration: '7:16', done: false, youtubeId: '2TEa9DEoQeI' },
      { title: 'Aula 9: Estratégias de Longo Prazo e Juros Compostos', duration: '9:40', done: false, youtubeId: 'lCdhOXGoS1M' },
      { title: 'Aula 10: Mentalidade Financeira e Próximos Passos', duration: '12:51', done: false, youtubeId: 'ItiZlFPALHs' }
    ],
    completed: false
  },
  {
    id: 'course-20',
    title: 'Curso Básico Mecânica Automotiva GRÁTIS',
    logo: 'Wrench',
    coverImage: 'https://img.youtube.com/vi/JYQNMqkYa00/hqdefault.jpg',
    desc: 'Adquira conhecimentos práticos fundamentais sobre mecânica automotiva de nível profissionalizante. Aprenda sobre o funcionamento interno de motores de combustão interna, cabeçotes, sistemas elétricos, suspensão, freios, diagnóstico de problemas e manutenção preventiva diária.',
    category: 'Mecânica',
    duration: '7 aulas (46m)',
    instructor: 'Especialista em Diagnóstico Automotivo',
    rating: 4.9,
    level: 'Iniciante',
    lessons: [
      { title: 'Aula 1: Introdução à Mecânica Automotiva e Motores', duration: '10:04', done: false, youtubeId: 'JYQNMqkYa00' },
      { title: 'Aula 2: Funcionamento Interno do Motor de 4 Tempos', duration: '5:05', done: false, youtubeId: 'GVwLWJZ-Muo' },
      { title: 'Aula 3: Entendendo o Cabeçote e Componentes Internos', duration: '6:53', done: false, youtubeId: 'T7pRaG0Vcg8' },
      { title: 'Aula 4: Sistemas Auxiliares do Motor', duration: '7:07', done: false, youtubeId: 'rD-iruNpVaU' },
      { title: 'Aula 5: Sistema de Transmissão e Diferencial', duration: '7:47', done: false, youtubeId: 'fwOJNKiLdfk' },
      { title: 'Aula 6: Fundamentos de Suspensão e Chassi', duration: '7:14', done: false, youtubeId: '7SalIn53Ams' },
      { title: 'Aula 7: Dicas Gerais de Segurança e Manutenção', duration: '1:40', done: false, youtubeId: 'JTSGEJg-LT4' }
    ],
    completed: false
  },
  {
    id: 'course-19',
    title: 'Curso de Qualidade no Atendimento ao Cliente',
    logo: 'MessageSquare',
    coverImage: 'https://img.youtube.com/vi/ej4TwLPrK3k/hqdefault.jpg',
    desc: 'Desenvolva habilidades essenciais para encantar e fidelizar clientes. Aprenda técnicas avançadas de comunicação verbal e corporativa, empatia, foco na solução de problemas, inteligência emocional e gestão de conflitos no atendimento diário.',
    category: 'Atendimento',
    duration: '8 aulas (1h 17m)',
    instructor: 'Especialista em Sucesso do Cliente e Atendimento',
    rating: 4.9,
    level: 'Iniciante ao Avançado',
    lessons: [
      { title: 'Aula 1: Introdução ao Atendimento de Excelência', duration: '3:30', done: false, youtubeId: 'ej4TwLPrK3k' },
      { title: 'Aula 2: Perfil do Profissional de Atendimento de Alta Performance', duration: '9:24', done: false, youtubeId: 'ASfGtovTNrY' },
      { title: 'Aula 3: Comunicação Assertiva no Atendimento ao Cliente', duration: '9:28', done: false, youtubeId: 'hNBInMl1IK8' },
      { title: 'Aula 4: Técnicas de Abordagem, Sintonia e Contato Inicial', duration: '12:15', done: false, youtubeId: 'qqR03xyLCuQ' },
      { title: 'Aula 5: Empatia, Conexão Humana e Escuta Ativa', duration: '12:21', done: false, youtubeId: 'Mhu0n82jppw' },
      { title: 'Aula 6: Como Gerenciar Diálogos e Clientes Difíceis', duration: '11:47', done: false, youtubeId: 'DFXhmnLTF3I' },
      { title: 'Aula 7: Resolução Ágil de Problemas e Encantamento', duration: '9:59', done: false, youtubeId: '_cnNg2CPlNQ' },
      { title: 'Aula 8: Fidelização de Clientes e Pós-Venda Estratégico', duration: '8:22', done: false, youtubeId: '-QG6lnYvO7E' }
    ],
    completed: false
  },
  {
    id: 'course-18',
    title: 'Curso Completo de Auxiliar Administrativo - Profissionalizante',
    logo: 'FileText',
    coverImage: 'https://img.youtube.com/vi/YPgg5I9ZkLM/hqdefault.jpg',
    desc: 'Capacitação completa e definitiva para o mercado corporativo. Aprenda do Absoluto Zero ao Avançado todas as rotinas administrativas, controle de caixa, organização de documentos, atendimento, noções de RH e ferramentas reais de produtividade.',
    category: 'Administração',
    duration: '10 aulas completas',
    instructor: 'Kultivi Carreiras / Especialista',
    rating: 5.0,
    level: 'Iniciante ao Avançado',
    lessons: [
      { title: 'Aula 1: Perfil Profissional e Mercado de Trabalho', duration: '5:48', done: false, youtubeId: 'YPgg5I9ZkLM' },
      { title: 'Aula 2: Ética no Ambiente Corporativo e Postura', duration: '5:46', done: false, youtubeId: 'ltwXPUyrAOw' },
      { title: 'Aula 3: Conceitos Básicos de Organização e Fluxo de Trabalho', duration: '12:18', done: false, youtubeId: 'v5LsWB-B094' },
      { title: 'Aula 4: Técnicas de Comunicação Assertiva e Atendimento', duration: '9:08', done: false, youtubeId: 'pdApED8oFlk' },
      { title: 'Aula 5: Organização de Arquivos, Pastas e Documentos', duration: '18:42', done: false, youtubeId: 'fb-4RN-BUcA' },
      { title: 'Aula 6: Documentações Empresariais e Ofícios Comuns', duration: '14:03', done: false, youtubeId: '-xk17wrXAho' },
      { title: 'Aula 7: Fundamentos de Matemática Financeira e Orçamentos', duration: '7:37', done: false, youtubeId: 'pmG4J6lnrcI' },
      { title: 'Aula 8: Controle de Fluxo de Caixa e faturamento diário', duration: '6:12', done: false, youtubeId: 'mb2HvZBBYpc' },
      { title: 'Aula 9: Noções de Recursos Humanos, Admissão e DP', duration: '7:37', done: false, youtubeId: 'MXxBsKmELrE' },
      { title: 'Aula 10: Técnicas Avançadas de Gestão de Tempo e Conclusão', duration: '11:55', done: false, youtubeId: 'mwGfmVqcNLI' }
    ],
    completed: false
  },

  {
    id: 'course-15',
    title: 'Curso de Excel Completo - Do Zero ao Avançado',
    logo: 'Layout',
    coverImage: 'https://img.youtube.com/vi/I2taMQ3j6qo/hqdefault.jpg',
    desc: 'Curso completo de Excel para quem quer sair do zero e chegar ao nível avançado. Aprenda fórmulas, tabelas dinâmicas, dashboards e automação.',
    category: 'Produtividade',
    duration: '10 aulas',
    instructor: 'Grupo Ninja',
    rating: 5.0,
    level: 'Iniciante ao Avançado',
    lessons: [
      { title: 'AULÃO DE EXCEL 2026 | Nível Básico 01 | Curso de Excel', duration: '24:41', done: false, youtubeId: 'I2taMQ3j6qo' },
      { title: 'AULÃO DE EXCEL 2024 | Nível Básico Aula 02 | CURSO DE EXCEL', duration: '21:11', done: false, youtubeId: 'OHM4CJbea54' },
      { title: 'Curso Excel | AULA 01 | Introdução ao Excel', duration: '10:57', done: false, youtubeId: 'qQLT_uoMN0U' },
      { title: 'Curso Excel | AULA 02 | Operando na Planilha', duration: '8:00', done: false, youtubeId: '7h5ZesJZ9o8' },
      { title: 'Curso Excel | AULA 03 | Formatando sua Planilha', duration: '11:06', done: false, youtubeId: 'Qj5ar291SHM' },
      { title: 'Curso Excel | AULA 04 | Formatando Planilha como Tabela', duration: '4:01', done: false, youtubeId: 'ksT1bSwzreo' },
      { title: 'Curso Excel | AULA 05 | Fórmulas no Excel', duration: '8:51', done: false, youtubeId: 'tetFYM7Eu_o' },
      { title: 'Curso Excel | AULA 06 | Adicionando Comentários no Excel', duration: '2:54', done: false, youtubeId: 'twxZ-dr2Xvw' },
      { title: '[Aula de Excel] A importância de Formatar como Tabela no Excel', duration: '10:26', done: false, youtubeId: 'MgC-Kn4RUtI' },
      { title: 'AULÃO DE EXCEL 2024 [Nível BÁSICO] Curso de Excel para Iniciantes | Passo a Passo', duration: '18:41', done: false, youtubeId: 'aFk0a0czSEU' }
    ],
    completed: false
  },
  { id: 'course-13',
    title: 'Mini Curso sobre Empreendedorismo Digital',
    logo: 'Megaphone',
    coverImage: 'https://img.youtube.com/vi/ynCMHhUP2g4/hqdefault.jpg',
    desc: 'Um mini curso completo para você dar os primeiros passos no empreendedorismo digital. Aprenda as bases para criar e gerenciar seu negócio na internet.',
    category: 'Negócios',
    duration: '55m (23 aulas)',
    instructor: 'Oportuniza Cursos',
    rating: 5.0,
    level: 'Livre',
    lessons: [
      { title: 'O que é o Empreendedorismo Digital', duration: '2:26', done: false, youtubeId: 'ynCMHhUP2g4' },
      { title: 'Qual é o seu propósito no Empreendedorismo?', duration: '2:23', done: false, youtubeId: 'EYFcU1dUDII' },
      { title: 'O que é Nicho de Mercado?', duration: '1:48', done: false, youtubeId: 'Nj-pSujt6w0' },
      { title: 'Exemplos de Empreendedores Digitais', duration: '2:26', done: false, youtubeId: 'PUVaEud1fHE' },
      { title: 'Entendendo o Home Office', duration: '2:25', done: false, youtubeId: '-9eNitTmPsM' },
      { title: 'Dicas para trabalhar muito bem em Home Office', duration: '4:07', done: false, youtubeId: 'R5ssc2piEOY' },
      { title: 'Como funciona o Sistema de Afiliados', duration: '2:32', done: false, youtubeId: '0j3spikSJCw' },
      { title: 'Quais os Principais Programas de Afiliados?', duration: '4:10', done: false, youtubeId: '13m5z0LR1nw' },
      { title: 'O que é o FreeLancer', duration: '2:01', done: false, youtubeId: 'xeXey-3dEWA' },
      { title: 'Plataformas para FreeLancer', duration: '2:06', done: false, youtubeId: 'Un4KHhWPLrQ' },
      { title: 'Comprando um Domínio Web', duration: '2:16', done: false, youtubeId: '33QSNGxgvys' },
      { title: 'Formas para ter seu Website', duration: '2:22', done: false, youtubeId: 'SsUb-CyQqv0' },
      { title: 'Onde criar minha Logomarca', duration: '1:50', done: false, youtubeId: '1OBL0Xi268A' },
      { title: 'Formatos de Conteúdo para sua Estratégia de Marketing Digital', duration: '2:40', done: false, youtubeId: 'eNo91RL1wJY' },
      { title: 'Entendendo como criar conteúdo', duration: '2:10', done: false, youtubeId: '2ihDxMnpl8M' },
      { title: 'O que é o Marketing de Conteúdo', duration: '2:12', done: false, youtubeId: 'AJTszpf0vS0' },
      { title: 'Produzir conteúdo com Marketing de Conteúdo', duration: '1:59', done: false, youtubeId: '-o8mnnu99WU' },
      { title: 'Entendendo o que é o SEO', duration: '2:25', done: false, youtubeId: 'K4KX5rQwqZI' },
      { title: 'O que é o Copywriting', duration: '1:58', done: false, youtubeId: 'wRb81Ac8Vt0' },
      { title: 'O que é o CTA (Call to Action)', duration: '2:12', done: false, youtubeId: 'KBE2xVDvx9E' },
      { title: 'Entendendo o E-mail Marketing', duration: '3:47', done: false, youtubeId: 'D-71tC3liwY' },
      { title: 'Entendendo o Google News', duration: '3:02', done: false, youtubeId: '2lriCS2RUoo' },
      { title: 'O que é o Marketing Viral e Buzz Marketing', duration: '2:45', done: false, youtubeId: '2mimEFGC2m4' }
    ],
    completed: false
  },
  {
    id: 'course-12',
    title: 'Curso de Marketing & Vendas COMPLETO',
    logo: 'Megaphone',
    coverImage: 'https://img.youtube.com/vi/lQV5myhSqCs/hqdefault.jpg',
    desc: 'O curso de Marketing e Vendas mais completo. Aprenda as melhores estratégias, técnicas de vendas e como usar o marketing a seu favor no mercado atual.',
    category: 'Negócios',
    duration: '9h (9 aulas)',
    instructor: 'Oportuniza Cursos',
    rating: 5.0,
    level: 'Livre',
    lessons: [
      { title: 'Marketing & Vendas - Aula 1', duration: '56:06', done: false, youtubeId: 'lQV5myhSqCs' },
      { title: 'Marketing & Vendas - Aula 2', duration: '1:03:58', done: false, youtubeId: 'DcevtFD2sd0' },
      { title: 'Marketing & Vendas - Aula 3', duration: '51:40', done: false, youtubeId: 'BziRr9KioV0' },
      { title: 'Marketing & Vendas - Aula 4', duration: '1:03:14', done: false, youtubeId: 'CtBZAQDwTb0' },
      { title: 'Marketing & Vendas - Aula 5', duration: '1:02:09', done: false, youtubeId: 'O0rerzKT6w0' },
      { title: 'Marketing & Vendas - Aula 6', duration: '1:00:10', done: false, youtubeId: 'D5T6vmnZI58' },
      { title: 'Marketing & Vendas - Aula 7', duration: '1:00:20', done: false, youtubeId: 'SDve4_FO60o' },
      { title: 'Marketing & Vendas - Aula 8', duration: '52:36', done: false, youtubeId: 'MiZj6zHjoFI' },
      { title: 'Marketing & Vendas - Aula 9', duration: '57:26', done: false, youtubeId: 'OyQ_Gt-uBe0' }
    ],
    completed: false
  },
  {
    id: 'course-11',
    title: 'Curso sobre Inteligência Artificial COMPLETO',
    logo: 'Terminal',
    coverImage: 'https://img.youtube.com/vi/iAbNKZTZ4MM/hqdefault.jpg',
    desc: 'O curso de Inteligência Artificial mais completo do Brasil. Domine Machine Learning, Redes Neurais, Transformers, Engenharia de Prompts e crie soluções práticas de IA Generativa com quem entende do assunto.',
    category: 'Tecnologia',
    duration: '10h (36 aulas)',
    instructor: 'Gustavo Guanabara (Curso em Vídeo)',
    rating: 5.0,
    level: 'Iniciante',
    lessons: [
      { title: 'Curso de Inteligência Artificial - AULA #1', duration: '4:35', done: false, youtubeId: 'iAbNKZTZ4MM' },
      { title: 'Introdução a Inteligência Artificial - AULA #2', duration: '15:21', done: false, youtubeId: 'cHYej6R7g2c' },
      { title: 'Sub áreas da Inteligência Artificial - AULA #3', duration: '14:48', done: false, youtubeId: 'QiWof7gCOqU' },
      { title: 'História da Inteligência Artificial do surgimento até a década de 70 - AULA #4', duration: '16:40', done: false, youtubeId: 'cQq-fveTpgc' },
      { title: 'História da Inteligência Artificial dos anos 70 até os dias atuais - AULA #5', duration: '19:04', done: false, youtubeId: 'g28HAs46yBI' },
      { title: 'Introdução à agentes inteligentes - AULA #6', duration: '11:58', done: false, youtubeId: 'r6xzToLv3M8' },
      { title: 'Agentes Inteligentes Racionais - AULA #7', duration: '13:05', done: false, youtubeId: 'oTfRHaKqmcw' },
      { title: 'Tipos de Agentes Inteligentes - AULA #8', duration: '14:30', done: false, youtubeId: 'VCOEKPx5pa8' },
      { title: 'Introdução a Sistemas Especialistas - AULA #9', duration: '12:48', done: false, youtubeId: '6a0czCkaZqY' },
      { title: 'Aquisição do Conhecimento - AULA #10', duration: '11:09', done: false, youtubeId: 'BNedjuNtRwg' },
      { title: 'Resolução de Problemas por meio de Busca - AULA #11', duration: '14:03', done: false, youtubeId: '1Cj8CK3o3dI' },
      { title: 'Exemplos de Resolução de Problemas por meio de Busca - AULA #12', duration: '15:02', done: false, youtubeId: 'Hbehbim20-8' },
      { title: 'Busca Cega - AULA #13', duration: '21:48', done: false, youtubeId: 'eQfJQuiBrpo' },
      { title: 'Algoritmos de Busca Heurística - AULA #14', duration: '17:32', done: false, youtubeId: 'cvN2qu6iN80' },
      { title: 'Definição de Heurísticas - AULA #15', duration: '10:38', done: false, youtubeId: 'DClk_mWpbPc' },
      { title: 'Conceito de Busca Local - AULA #16', duration: '11:06', done: false, youtubeId: 'R_PGFEjaEmk' },
      { title: 'Algoritmos de Busca Local - AULA #17', duration: '17:44', done: false, youtubeId: 'lgLlTNuyUeM' },
      { title: 'Introdução ao Python - AULA #18', duration: '15:41', done: false, youtubeId: 'Mwn5NpYQHZQ' },
      { title: 'Tuplas e Listas em Python - AULA #19', duration: '14:51', done: false, youtubeId: 'uYanGqJRO-0' },
      { title: 'Sets, conversões e leitura e escrita de arquivos - AULA #20', duration: '13:31', done: false, youtubeId: 'KJWBOcdnJGo' },
      { title: 'Manipulação de Strings, Classes e Imports - AULA #21', duration: '11:34', done: false, youtubeId: 'T5fZ4CUgnso' },
      { title: 'Algoritmos Genéticos - AULA #22', duration: '12:30', done: false, youtubeId: 'qGFDkA0X06w' },
      { title: 'Algoritmos genéticos - o passo a passo - AULA #23', duration: '23:35', done: false, youtubeId: 'rwE1UGjEjQI' },
      { title: 'Busca Competitiva - AULA #24', duration: '15:22', done: false, youtubeId: 'klz14yfpWcQ' },
      { title: 'Exemplos de Busca Competitiva - AULA #25', duration: '14:37', done: false, youtubeId: 'dCH7DS6VdTY' },
      { title: 'Conceitos de Aprendizado de Máquina - AULA #26', duration: '15:02', done: false, youtubeId: 'wn72PwNhFXI' },
      { title: 'Tipos de Problemas de Aprendizado Máquina - AULA #27', duration: '15:32', done: false, youtubeId: '0pwo-gHBlZY' },
      { title: 'Árvores de Decisão - AULA #28', duration: '12:37', done: false, youtubeId: 'ZWRb0ttTGXQ' },
      { title: 'KNN - AULA #29', duration: '14:25', done: false, youtubeId: 'ZSzi0oF-fN0' },
      { title: 'SVM - AULA#30', duration: '15:15', done: false, youtubeId: 'becJllQRYWc' },
      { title: 'Clustering ou agrupamento - AULA #31', duration: '17:39', done: false, youtubeId: 'tk9GcTjCAIU' },
      { title: 'Medidas de Avaliação de Performance - AULA #32', duration: '14:31', done: false, youtubeId: 'P9lVfHcp5DI' },
      { title: 'Conceitos de Redes Neurais Artificiais - AULA #33', duration: '22:14', done: false, youtubeId: 'EDCK5gMWc1A' },
      { title: 'Arquiteturas e Treinamento de RNAs - AULA #34', duration: '19:56', done: false, youtubeId: '2HBadYXNaKU' },
      { title: 'Backpropagation - AULA #35', duration: '18:51', done: false, youtubeId: '2HBadYXNaKU' },
      { title: 'Deep Learning - AULA #36', duration: '13:41', done: false, youtubeId: 'OOQc1uQz60c' }
    ],
    completed: false
  }
];

export const mockJobs: Job[] = (() => {
  try {
    const saved = localStorage.getItem('oportuniza-admin-jobs');
    return saved ? JSON.parse(saved) : DEFAULT_JOBS;
  } catch {
    return DEFAULT_JOBS;
  }
})();

export const mockCourses: Course[] = (() => {
  try {
    const saved = localStorage.getItem('oportuniza-admin-courses');
    return saved ? JSON.parse(saved) : DEFAULT_COURSES;
  } catch {
    return DEFAULT_COURSES;
  }
})();

// Real-time synchronization functions with Supabase (with automatic fallbacks)

export const loadJobsFromSupabase = async (): Promise<boolean> => {
  // Recover any existing jobs from any local storage keys to prevent data loss
  const mergedLocalJobsMap = new Map<string, Job>();
  
  // Populate default list first
  DEFAULT_JOBS.forEach(j => mergedLocalJobsMap.set(j.id, j));
  
  try {
    const backupJobsA = localStorage.getItem('oportuniza-jobs');
    if (backupJobsA) {
      const parsed = JSON.parse(backupJobsA);
      if (Array.isArray(parsed)) {
        parsed.forEach(j => {
          if (j && j.id) mergedLocalJobsMap.set(j.id, j);
        });
      }
    }
  } catch (e) {
    console.warn('Failed parsing backup jobs A:', e);
  }

  try {
    const backupJobsB = localStorage.getItem('oportuniza-admin-jobs');
    if (backupJobsB) {
      const parsed = JSON.parse(backupJobsB);
      if (Array.isArray(parsed)) {
        parsed.forEach(j => {
          if (j && j.id) mergedLocalJobsMap.set(j.id, j);
        });
      }
    }
  } catch (e) {
    console.warn('Failed parsing backup jobs B:', e);
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Supabase jobs fetch failed, using fallback:', error.message);
      const fallbackList = Array.from(mergedLocalJobsMap.values());
      mockJobs.length = 0;
      mockJobs.push(...fallbackList);
      localStorage.setItem('oportuniza-admin-jobs', JSON.stringify(fallbackList));
      localStorage.setItem('oportuniza-jobs', JSON.stringify(fallbackList));
      window.dispatchEvent(new Event('oportuniza-jobs-changed'));
      return false;
    }

    const mappedJobs: Job[] = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      company: item.company || item.company_name,
      category: item.category || 'Geral',
      description: item.description,
      requirements: Array.isArray(item.requirements) ? item.requirements : (item.requirements ? [item.requirements] : []),
      salary: item.salary,
      type: item.type,
      isRemote: item.isRemote !== false,
      location: item.location,
      lat: item.lat,
      lng: item.lng,
      logo: item.logo || item.company_logo_url || 'Briefcase',
      dateString: item.dateString || item.posted_date || 'Hoje',
      color: item.color,
      active: item.active !== false,
      startDate: item.startDate || item.start_date || undefined,
      endDate: item.endDate || item.end_date || undefined,
      workHours: item.workHours || item.work_hours || undefined,
      companyAddress: item.companyAddress || item.company_address || undefined,
      companyNeighborhood: item.companyNeighborhood || item.company_neighborhood || undefined,
      companyContactPhone: item.companyContactPhone || item.company_contact_phone || undefined,
      companyContactEmail: item.companyContactEmail || item.company_contact_email || undefined,
      companyResponsibleName: item.companyResponsibleName || item.company_responsible_name || undefined,
      companyResponsibleRole: item.companyResponsibleRole || item.company_responsible_role || undefined,
      companyLogoUrl: item.companyLogoUrl || item.company_logo_url || item.logo || undefined,
      cnpj: item.cnpj || undefined,
      approvalStatus: item.approvalStatus || item.approval_status || (item.company?.includes('FarmaBem') || item.company?.includes('Indústria') ? 'accepted' : 'accepted'),
      approvedBy: item.approvedBy || item.approved_by || undefined,
      approvedAt: item.approvedAt || item.approved_at || undefined,
      acceptedCandidatesCount: item.acceptedCandidatesCount || item.accepted_candidates_count || 0
    }));

    // Add fetched items to the map (fetched items take precedence over local items with the same ID)
    mappedJobs.forEach(j => {
      mergedLocalJobsMap.set(j.id, j);
    });

    // Detect and replace blank/malformed jobs (with empty or missing titles or companies)
    const newJobsAsFull: Job[] = NEW_JOBS.map((nj, index) => ({
      ...nj,
      id: `job-new-p${index + 1}`
    }));

    const blankJobs = Array.from(mergedLocalJobsMap.values()).filter(j => 
      !j.title || j.title.trim() === '' || !j.company || j.company.trim() === ''
    );

    const usedIndexes = new Set<number>();

    // Overwrite the blank rows with the new real jobs
    blankJobs.forEach((bj, bjIdx) => {
      if (bjIdx < newJobsAsFull.length) {
        const replacement: Job = {
          ...newJobsAsFull[bjIdx],
          id: bj.id // Keep the ID of the blank row so we overwrite it inside DB
        };
        mergedLocalJobsMap.set(bj.id, replacement);
        usedIndexes.add(bjIdx);
      } else {
        mergedLocalJobsMap.delete(bj.id);
      }
    });

    // Add remaining new jobs that haven't been used as replacements
    newJobsAsFull.forEach((nj, njIdx) => {
      if (!usedIndexes.has(njIdx)) {
        if (!mergedLocalJobsMap.has(nj.id)) {
          mergedLocalJobsMap.set(nj.id, nj);
        }
      }
    });

    // Strip out any elements that are somehow still blank to keep things completely pristine
    for (const [key, val] of mergedLocalJobsMap.entries()) {
      if (!val || !val.title || val.title.trim() === '' || !val.company || val.company.trim() === '') {
        mergedLocalJobsMap.delete(key);
      }
    }

    const finalMergedJobs = Array.from(mergedLocalJobsMap.values());

    mockJobs.length = 0;
    mockJobs.push(...finalMergedJobs);
    localStorage.setItem('oportuniza-admin-jobs', JSON.stringify(finalMergedJobs));
    localStorage.setItem('oportuniza-jobs', JSON.stringify(finalMergedJobs));
    window.dispatchEvent(new Event('oportuniza-jobs-changed'));
    return true;
  } catch (err) {
    console.warn('Uncaught error fetching jobs from Supabase:', err);
    const fallbackList = Array.from(mergedLocalJobsMap.values());
    mockJobs.length = 0;
    mockJobs.push(...fallbackList);
    localStorage.setItem('oportuniza-admin-jobs', JSON.stringify(fallbackList));
    localStorage.setItem('oportuniza-jobs', JSON.stringify(fallbackList));
    window.dispatchEvent(new Event('oportuniza-jobs-changed'));
  }
  return false;
};

export const loadCoursesFromSupabase = async (): Promise<boolean> => {
  // Recover any existing courses from any local storage keys to prevent data loss
  const mergedLocalCoursesMap = new Map<string, Course>();

  // Populate default list first
  DEFAULT_COURSES.forEach(c => mergedLocalCoursesMap.set(c.id, c));

  try {
    const backupCoursesA = localStorage.getItem('oportuniza-courses');
    if (backupCoursesA) {
      const parsed = JSON.parse(backupCoursesA);
      if (Array.isArray(parsed)) {
        parsed.forEach(c => {
          if (c && c.id) mergedLocalCoursesMap.set(c.id, c);
        });
      }
    }
  } catch (e) {
    console.warn('Failed parsing backup courses A:', e);
  }

  try {
    const backupCoursesB = localStorage.getItem('oportuniza-admin-courses');
    if (backupCoursesB) {
      const parsed = JSON.parse(backupCoursesB);
      if (Array.isArray(parsed)) {
        parsed.forEach(c => {
          if (c && c.id) mergedLocalCoursesMap.set(c.id, c);
        });
      }
    }
  } catch (e) {
    console.warn('Failed parsing backup courses B:', e);
  }

  // Filter out the two specified courses from the local map so they are removed now and won't be re-saved
  for (const [key, value] of mergedLocalCoursesMap.entries()) {
    if (
      !value ||
      !value.title ||
      value.title.trim() === '' ||
      value.id === 'c-1' ||
      value.id === 'c-2' ||
      value.id === 'course-16' ||
      value.id === 'course-17' ||
      value.title === 'Desenvolvimento Web Moderno' ||
      value.title === 'Design de Interfaces (UI/UX)' ||
      value.title === 'Design de Interfaces (UI)' ||
      value.title === 'Curso de Auxiliar Administrativo e Rotinas de Organização' ||
      value.title === 'Curso de Atendimento ao Cliente de Excelente Desempenho'
    ) {
      mergedLocalCoursesMap.delete(key);
    }
  }

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Supabase courses fetch failed, using fallback:', error.message);
      const fallbackList = Array.from(mergedLocalCoursesMap.values()).filter(c => c && c.title && c.title.trim() !== '');
      mockCourses.length = 0;
      mockCourses.push(...fallbackList);
      localStorage.setItem('oportuniza-admin-courses', JSON.stringify(fallbackList));
      localStorage.setItem('oportuniza-courses', JSON.stringify(fallbackList));
      window.dispatchEvent(new Event('oportuniza-courses-changed'));
      return false;
    }

    const mappedCourses: Course[] = (data || [])
      .map((item: any) => ({
        id: item.id,
        title: item.title,
        desc: item.description || item.desc,
        category: item.category,
        duration: item.duration,
        instructor: item.instructor,
        rating: Number(item.rating || 5.0),
        level: item.level,
        logo: item.logo,
        coverImage: item.coverImage,
        lessons: Array.isArray(item.lessons) ? item.lessons : [],
        completed: item.completed === true,
        active: item.active !== false
      }))
      .filter((item: Course) => 
        item &&
        item.title &&
        item.title.trim() !== '' &&
        item.id !== 'c-1' && 
        item.id !== 'c-2' && 
        item.id !== 'course-16' && 
        item.id !== 'course-17' && 
        item.title !== 'Desenvolvimento Web Moderno' && 
        item.title !== 'Design de Interfaces (UI/UX)' && 
        item.title !== 'Design de Interfaces (UI)' &&
        item.title !== 'Curso de Auxiliar Administrativo e Rotinas de Organização' &&
        item.title !== 'Curso de Atendimento ao Cliente de Excelente Desempenho'
      );

    // Add fetched items to the map (take precedence over local items)
    mappedCourses.forEach(c => {
      if (c && c.title && c.title.trim() !== '') {
        mergedLocalCoursesMap.set(c.id, c);
      }
    });

    const finalMergedCourses = Array.from(mergedLocalCoursesMap.values()).filter(c => c && c.title && c.title.trim() !== '');

    // Sync any local-only custom entries back up to Supabase so they are shared with everyone
    const localOnlyCourses = finalMergedCourses.filter(c => !mappedCourses.some(mc => mc.id === c.id));
    if (localOnlyCourses.length > 0) {
      console.log('Synchronizing local custom courses to database:', localOnlyCourses.length);
      const recordsToUpsert = localOnlyCourses.map(c => ({
        id: c.id,
        title: c.title,
        description: c.desc,
        category: c.category,
        duration: c.duration,
        instructor: c.instructor,
        rating: c.rating,
        level: c.level,
        logo: c.logo || '',
        coverImage: c.coverImage || '',
        lessons: c.lessons,
        completed: c.completed || false,
        active: c.active !== false
      }));
      await supabase.from('courses').upsert(recordsToUpsert);
    }

    mockCourses.length = 0;
    mockCourses.push(...finalMergedCourses);
    localStorage.setItem('oportuniza-admin-courses', JSON.stringify(finalMergedCourses));
    localStorage.setItem('oportuniza-courses', JSON.stringify(finalMergedCourses));
    window.dispatchEvent(new Event('oportuniza-courses-changed'));
    return true;
  } catch (err) {
    console.warn('Uncaught error fetching courses from Supabase:', err);
    const fallbackList = Array.from(mergedLocalCoursesMap.values());
    mockCourses.length = 0;
    mockCourses.push(...fallbackList);
    localStorage.setItem('oportuniza-admin-courses', JSON.stringify(fallbackList));
    localStorage.setItem('oportuniza-courses', JSON.stringify(fallbackList));
    window.dispatchEvent(new Event('oportuniza-courses-changed'));
  }
  return false;
};

export const deleteJobPermanently = async (jobId: string): Promise<boolean> => {
  const index = mockJobs.findIndex(j => j.id === jobId);
  if (index !== -1) {
    mockJobs.splice(index, 1);
  }
  localStorage.setItem('oportuniza-admin-jobs', JSON.stringify(mockJobs));
  localStorage.setItem('oportuniza-jobs', JSON.stringify(mockJobs));
  window.dispatchEvent(new Event('oportuniza-jobs-changed'));

  try {
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) {
      console.warn('Supabase job direct delete note:', error.message);
    }
    return true;
  } catch (err) {
    console.warn('Supabase direct delete error:', err);
    return false;
  }
};

export const saveAdminJobs = async (jobs: Job[]) => {
  mockJobs.length = 0;
  mockJobs.push(...jobs);
  localStorage.setItem('oportuniza-admin-jobs', JSON.stringify(jobs));
  localStorage.setItem('oportuniza-jobs', JSON.stringify(jobs));
  window.dispatchEvent(new Event('oportuniza-jobs-changed'));

  try {
    // Delete in supabase for items NOT in the incoming array to simulate synced deletes
    const ids = jobs.map(j => j.id);
    if (ids.length > 0) {
      const formattedIds = `'${ids.join("','")}'`;
      await supabase.from('jobs').delete().filter('id', 'not.in', `(${formattedIds})`);
    } else {
      await supabase.from('jobs').delete().neq('id', 'temp_placeholder_dummy');
    }

    if (jobs.length > 0) {
      const records = jobs.map(j => ({
        id: j.id,
        title: j.title,
        company: j.company,
        category: j.category,
        description: j.description,
        requirements: j.requirements,
        salary: j.salary,
        type: j.type,
        isRemote: j.isRemote,
        location: j.location,
        lat: j.lat,
        lng: j.lng,
        logo: j.logo,
        dateString: j.dateString,
        color: j.color || '',
        start_date: j.startDate,
        end_date: j.endDate,
        work_hours: j.workHours,
        company_address: j.companyAddress,
        company_neighborhood: j.companyNeighborhood,
        company_contact_phone: j.companyContactPhone,
        company_contact_email: j.companyContactEmail,
        company_responsible_name: j.companyResponsibleName,
        company_responsible_role: j.companyResponsibleRole,
        company_logo_url: j.companyLogoUrl,
        cnpj: j.cnpj,
        approval_status: j.approvalStatus || 'accepted',
        approved_by: j.approvedBy,
        approved_at: j.approvedAt,
        accepted_candidates_count: j.acceptedCandidatesCount || 0
      }));
      const { error: syncErr } = await supabase.from('jobs').upsert(records);
      if (syncErr) {
        const fallbackRecords = jobs.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          description: j.description,
          salary: j.salary,
          type: j.type,
          location: j.location
        }));
        await supabase.from('jobs').upsert(fallbackRecords);
      }
    }
  } catch (err) {
    console.warn('Supabase jobs sync failed, keeping local storage sync active:', err);
  }
};

export const saveAdminCourses = async (courses: Course[]) => {
  const filteredCourses = (courses || []).filter(c => c && c.title && c.title.trim() !== '');
  mockCourses.length = 0;
  mockCourses.push(...filteredCourses);
  localStorage.setItem('oportuniza-admin-courses', JSON.stringify(filteredCourses));
  localStorage.setItem('oportuniza-courses', JSON.stringify(filteredCourses));
  window.dispatchEvent(new Event('oportuniza-courses-changed'));

  try {
    const ids = filteredCourses.map(c => c.id);
    if (ids.length > 0) {
      const formattedIds = `'${ids.join("','")}'`;
      await supabase.from('courses').delete().filter('id', 'not.in', `(${formattedIds})`);
    } else {
      await supabase.from('courses').delete().neq('id', 'temp_placeholder_dummy');
    }

    if (filteredCourses.length > 0) {
      const records = filteredCourses.map(c => ({
        id: c.id,
        title: c.title,
        description: c.desc,
        category: c.category,
        duration: c.duration,
        instructor: c.instructor,
        rating: c.rating,
        level: c.level,
        logo: c.logo || '',
        coverImage: c.coverImage || '',
        lessons: c.lessons,
        completed: c.completed || false,
        active: c.active !== false
      }));
      await supabase.from('courses').upsert(records);
    }
  } catch (err) {
    console.warn('Supabase courses sync failed, keeping local storage sync active:', err);
  }
};

export const MAP_PARTNERS = [
  {
    id: 'map-p1',
    name: 'CIEE Unidade Central',
    lat: -25.5925,
    lng: -49.4080,
    type: 'Estágios & Menor Aprendiz',
    address: 'R. Pedro Druszcz, 120 - Araucária',
    jobsCount: 14,
    x: 48, // offset percentage for mock vector map
    y: 35
  },
  {
    id: 'map-p2',
    name: 'SENAI Hub Tecnológico',
    lat: -25.4215,
    lng: -49.2710,
    type: 'Cursos & Qualificação',
    address: 'Av. Cândido de Abreu, 1500 - Curitiba',
    jobsCount: 8,
    x: 75,
    y: 58
  },
  {
    id: 'map-p3',
    name: 'Oportuniza Coworking Social',
    lat: -25.4410,
    lng: -49.2750,
    type: 'Suporte & Computadores Grátis',
    address: 'Av. Victor Ferreira do Amaral, 450 - Curitiba',
    jobsCount: 3,
    x: 25,
    y: 20
  },
  {
    id: 'map-p4',
    name: 'Centro de Capacitação do Trabalhador',
    lat: -25.5890,
    lng: -49.4150,
    type: 'Empregos CLT',
    address: 'Av. Dr. Victor do Amaral, 800 - Araucária',
    jobsCount: 22,
    x: 62,
    y: 80
  }
];
