import {Box, Text} from 'ink';

const Title = () => (
	<Box
		key="title"
		flexDirection="row"
		borderTop={false}
		borderLeft={false}
		borderRight={false}
		borderStyle="round"
		borderColor="#3396FF"
	>
		<Box marginRight={1}>
			<Text bold>Token Conversions</Text>
		</Box>
	</Box>
);

export default Title;
