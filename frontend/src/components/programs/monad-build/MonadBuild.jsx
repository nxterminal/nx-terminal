import { BuildProvider, useBuild } from './BuildContext';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import HomeDashboard from './components/Home/HomeDashboard';
import LearnModule from './components/Learn/LearnModule';
import BuildModule from './components/Build/BuildModule';
import DeployModule from './components/Deploy/DeployModule';
import EcosystemModule from './components/Ecosystem/EcosystemModule';
import ResourcesModule from './components/Resources/ResourcesModule';
import './MonadBuild.css';

const MODULE_COMPONENTS = {
  home: HomeDashboard,
  learn: LearnModule,
  build: BuildModule,
  deploy: DeployModule,
  ecosystem: EcosystemModule,
  resources: ResourcesModule,
};

function MonadBuildInner() {
  const { state } = useBuild();
  const ActiveModule = MODULE_COMPONENTS[state.activeModule] || HomeDashboard;

  return (
    <div className="mb-root">
      <Sidebar />
      <div className="mb-content">
        <div className="mb-content-inner" key={state.activeModule}>
          <ActiveModule />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

export default function MonadBuild() {
  return (
    <BuildProvider>
      <MonadBuildInner />
    </BuildProvider>
  );
}
