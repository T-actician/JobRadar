// Built-in skills list. Lines are "Name|alias,alias|Category codes". A leading ! stops the name itself being an alias.
const CAT: Record<string, string> = {
  SE: 'Software Engineering', IT: 'Information Technology', CY: 'Cybersecurity', DS: 'Data Science', NW: 'Networking', TC: 'Telecommunications',
  EE: 'Electrical Engineering', EL: 'Electronics Engineering', CE: 'Civil Engineering', ME: 'Mechanical Engineering', BF: 'Business and Finance',
  AC: 'Accounting', AD: 'Administration', HR: 'Human Resources', HC: 'Healthcare', ED: 'Education', SR: 'Science and Research', MF: 'Manufacturing',
  CO: 'Construction', PR: 'Procurement', LG: 'Logistics', MK: 'Marketing', SA: 'Sales', AG: 'Agriculture', HO: 'Hospitality', GV: 'Government', NG: 'NGOs',
};

const RAW = `JavaScript|js|SE
TypeScript||SE
React|react.js,reactjs,react native|SE
Angular|angularjs|SE
Vue.js|vue,vuejs|SE
Node.js|nodejs,express.js|SE
Python||SE;DS
Java|java ee,j2ee|SE
C#|c sharp|SE
C++||SE;EL
PHP||SE
Laravel||SE
Django||SE
.NET|dotnet,asp.net|SE
Spring Boot|spring framework|SE
!Go|golang|SE
Kotlin||SE
iOS Development|ios,swiftui|SE
Android|android development|SE
Flutter||SE
REST APIs|rest api,restful|SE
GraphQL||SE
HTML||SE
CSS|css3|SE
Tailwind CSS|tailwind|SE
SQL|t-sql,pl/sql|SE;DS;IT
MySQL||SE;IT
PostgreSQL|postgres|SE;IT
MongoDB|mongo|SE
Firebase||SE
Git|github,gitlab|SE
Docker||SE;IT
Kubernetes|k8s|SE;IT
AWS|amazon web services|SE;IT
Microsoft Azure|azure|SE;IT
Google Cloud|gcp|SE;IT
Linux|ubuntu,red hat|IT;SE
DevOps|ci/cd,cicd,jenkins|SE;IT
Agile|scrum,kanban|SE;BF
UI/UX Design|ui/ux,ux design,ui design|SE
Figma||SE
Machine Learning||DS
Deep Learning|tensorflow,pytorch|DS
Data Analysis|data analytics,data analyst|DS
Power BI|powerbi|DS;BF
Tableau||DS
Microsoft Excel|excel,advanced excel,spreadsheets|BF;AC;AD;DS
Pandas|numpy|DS
Statistics|statistical analysis|DS;SR
SPSS|stata|SR;DS
Web Development|web developer|SE
Mobile Development|mobile app|SE
Cybersecurity|cyber security,information security,infosec|CY
Penetration Testing|pentest,ethical hacking,vulnerability assessment|CY
SIEM|splunk,soc analyst|CY
Firewalls|firewall,fortinet,palo alto|CY;NW
ISO 27001|iso27001|CY
Network Administration|network administrator,network engineer|NW;IT
Cisco|ccna,ccnp|NW;TC
Routing and Switching|routing,switching,ospf,bgp|NW
TCP/IP|tcpip,lan/wan|NW
Wireless Networks|wifi,wi-fi,wlan|NW;TC
VoIP|sip,pbx|NW;TC
Windows Server|active directory,group policy|IT
VMware|virtualization,hyper-v|IT
IT Support|helpdesk,help desk,technical support|IT
ITIL||IT
Database Administration|dba|IT
Cloud Computing|cloud|IT;SE
Fibre Optics|fiber optic,fibre,ftth|TC;NW
RF Engineering|radio frequency,microwave links|TC
Telecommunications|telecom,gsm,lte,4g,5g|TC
Power Systems|power system,power transmission,distribution networks|EE
Substations|substation,switchgear,transformers|EE
Electrical Installation|wiring,electrical wiring|EE;CO
PLC|plc programming,siemens,allen bradley|EE;EL;MF
SCADA|hmi,dcs|EE;EL
AutoCAD|autocad electrical|EE;CE;ME;CO
MATLAB|simulink|EE;EL;SR
Circuit Design|analog circuits,digital electronics|EL
PCB Design|altium,kicad|EL
Embedded Systems|microcontroller,microcontrollers,arduino,stm32,raspberry pi|EL;SE
Soldering||EL
Solar PV|solar,photovoltaic,renewable energy|EE
Protection and Control|relay protection|EE
Electrical Maintenance|motors,vfd|EE;MF
SolidWorks|catia|ME
CAD|cad/cam,3d modelling|ME;CE
Mechanical Design|machine design|ME
HVAC|refrigeration,air conditioning|ME
Welding|fabrication|ME;MF
Machining|cnc,lathe|ME;MF
Maintenance|preventive maintenance,plant maintenance|ME;MF
Manufacturing|production planning|MF
Quality Assurance|quality control,qa/qc,iso 9001|MF;SE
!Lean Manufacturing|lean manufacturing,six sigma,kaizen|MF
Revit|bim|CE;CO
Civil 3D|civil3d|CE
Structural Design|structural analysis,etabs,staad|CE
Surveying|total station,gis,arcgis,qgis|CE;CO
Site Supervision|site engineer,clerk of works|CE;CO
BOQ|bill of quantities,quantity surveying,estimating|CE;CO
Project Scheduling|ms project,primavera|CE;CO;BF
Construction Management|contract administration|CO;CE
Health and Safety|ohs,osha,hse|CO;MF;GV
Project Management|pmp,prince2,project coordination|BF;NG;CO
Accounting|bookkeeping,general ledger|AC
QuickBooks|sage,tally,pastel|AC
IFRS||AC
Auditing|internal audit,external audit,audit|AC
Taxation|kra,itax,vat|AC
Financial Reporting|financial statements,management accounts|AC;BF
Budgeting|forecasting,budget management|BF;AC
Payroll||AC;HR
Reconciliation|accounts payable,accounts receivable|AC
Financial Analysis|financial modelling,financial modeling|BF
Credit Analysis|loan appraisal,credit risk|BF
Risk Management|risk assessment|BF
CPA|acca|AC
Procurement|tendering,sourcing,purchasing|PR
Supply Chain|inventory management,warehousing,stock control|LG;PR
Logistics|freight,customs clearance,fleet management|LG
Sales|business development,lead generation,field sales|SA
Account Management|key accounts,client relations|SA
Customer Service|customer care,customer support|SA;HO;AD
CRM|salesforce,hubspot|SA;MK
Marketing|brand management|MK
Digital Marketing|seo,sem,google ads,social media|MK
Content Writing|copywriting,content creation|MK
Graphic Design|photoshop,illustrator,canva|MK
Public Relations|media relations|MK;NG
Human Resources|hr,talent management,employee relations|HR
Recruitment|talent acquisition,onboarding|HR
Training and Development|learning and development,capacity building|HR;ED;NG
Administration|office administration,secretarial,front office|AD
Records Management|filing,document control|AD
Monitoring and Evaluation|m&e|NG;SR
Grant Management|proposal writing,donor reporting,fundraising|NG
Community Development|community mobilization,outreach|NG
Public Health|epidemiology,health promotion|HC;NG
Nursing|patient care,clinical care|HC
Medical Laboratory|laboratory,phlebotomy|HC;SR
Pharmacy|pharmaceutical|HC
Teaching|lesson planning,classroom management,curriculum development|ED
Research|research methods,data collection|SR;ED
Agronomy|crop production,farm management,horticulture|AG
Food Safety|haccp|AG;MF;HO
Hospitality|front desk,housekeeping,food and beverage|HO
Policy Analysis|public policy,legislation|GV
Legal|legal research|GV;BF
Driving|driving licence,driving license|LG`;

const cats = new Map<string, string[]>();
const alias = new Map<string, string>();
for (const line of RAW.split('\n')) {
  const [rawName, aliases = '', codes = ''] = line.split('|');
  const name = rawName.replace(/^!/, '');
  cats.set(name, codes.split(';').filter(Boolean).map((c) => CAT[c]));
  if (!rawName.startsWith('!')) alias.set(name.toLowerCase(), name);
  for (const a of aliases.split(',').filter(Boolean)) alias.set(a.trim().toLowerCase(), name);
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const RX = new RegExp(`(?<![\\w+#.])(${[...alias.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\w+#])`, 'gi');

export const SKILL_NAMES: string[] = [...cats.keys()].sort((a, b) => a.localeCompare(b));
export const skillCategories = (skill: string): string[] => cats.get(skill) ?? [];

/** Skills from the built-in list that appear in the text. Anything not on the list is not recognised. */
export function findSkills(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(RX)) {
    const n = alias.get(m[1].toLowerCase());
    if (n) out.add(n);
  }
  return [...out];
}
