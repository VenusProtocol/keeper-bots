import {Box, BoxProps} from 'ink';

const BorderBox = ({
	all = false,
	borderColor = '',
	borderTop = false,
	borderBottom = false,
	borderRight = false,
	borderLeft = false,
	children,
	...rest
}: BoxProps & {
	all?: boolean;
	children: React.ReactNode | React.ReactNode[];
}) => (
	<Box
		borderColor={borderColor}
		borderTop={borderTop || all}
		borderBottom={borderBottom || all}
		borderRight={borderRight || all}
		borderLeft={borderLeft || all}
		{...rest}
	>
		{children}
	</Box>
);

export default BorderBox;
