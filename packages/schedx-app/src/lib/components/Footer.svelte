<script lang="ts">
	import { Github } from 'lucide-svelte';
</script>

<!-- ========== FOOTER ========== -->
<footer class="relative overflow-hidden bg-transparent">
	<div class="relative z-10">
		<div
			class="mx-auto flex w-full items-center justify-center px-4 py-8 md:justify-end md:px-6 lg:px-8 lg:py-12"
		>
			<div class="inline-flex items-center">
				<a
					href="https://github.com/wyatts97"
					class="flex items-center justify-center rounded-md p-2 text-gray-900 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white dark:hover:text-gray-300"
					aria-label="Open SchedX GitHub repository"
					target="_blank"
					rel="noopener noreferrer"
				>
					<Github class="h-6 w-6" />
				</a>

				<div class="ms-5 border-s border-gray-300 ps-5 dark:border-gray-600">
					<p class="text-sm text-gray-600 dark:text-gray-400">© 2025 SchedX. v1.0.0</p>
				</div>
			</div>
		</div>
	</div>
</footer>
<!-- ========== END FOOTER ========== -->
