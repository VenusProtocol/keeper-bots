import { Static } from "ink";

const StaticElements = ({ children }: { children: React.ReactNode[] }) => {
  return <Static items={Object.entries(children)}>{([_idx, child]) => child}</Static>;
};

export default StaticElements;
