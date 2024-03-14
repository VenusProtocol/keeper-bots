import {Box, Text} from 'ink';
import venus from '../constants/venus.js';

const Title = () => (
	<Box
		key="title"
		flexDirection="column"
		borderTop={false}
		borderLeft={false}
		borderRight={false}
		borderStyle="round"
		borderColor="#3396FF"
	>
		<Text>{venus}</Text>
		<Text bold>Token Conversions</Text>
	</Box>
);

export default Title;
