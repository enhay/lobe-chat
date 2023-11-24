import Page from './home';
import Redirect from './home/Redirect';

export const dynamicParams = false;

const Index = () => (
  <>
    <Page />
    <Redirect />
  </>
);

export default Index;
